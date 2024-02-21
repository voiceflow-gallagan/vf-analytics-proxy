require('dotenv').config()
const express = require('express')
const axios = require('axios')
const parser = require('ua-parser-js')
const bodyParser = require('body-parser')
const cors = require('cors')
const app = express()
const PORT = process.env.PORT || 3000
const VOICEFLOW_RUNTIME_URL =
  process.env.VOICEFLOW_RUNTIME_URL || 'https://general-runtime.voiceflow.com'

app.use(cors())
app.use(bodyParser.json())

app.use((req, res, next) => {
  if (req.path.includes('/interact')) {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`)
  }
  next()
})

// Function to forward requests and log responses
const forwardRequest = async (req, res) => {
  let targetUrl = `${VOICEFLOW_RUNTIME_URL}${req.originalUrl}`
  let headers = {
    ...req.headers,
    host: new URL(VOICEFLOW_RUNTIME_URL).host,
    origin: undefined,
  }

  if (req.path.includes('/interact')) {
    delete headers['content-length']
    req.body.config = { excludeTypes: ['speak', 'flow', 'block'], tts: false }
  }

  try {
    const response = await axios({
      method: req.method,
      url: targetUrl,
      data: req.body,
      headers: headers,
    })

    // Log the response from the runtime endpoint
    if (req.path.includes('/interact')) {
      /* Pass those info to your Business Analytics tool of choice */
      console.log(extractTraceInfo(response.data.trace, req.body, req.headers))
    }

    // Forward the response headers and status code
    res.set(response.headers)
    res.status(response.status).send(response.data)
  } catch (error) {
    if (error.response) {
      // Log the error response from the runtime endpoint
      if (req.path.includes('/interact')) {
        console.log(
          `${new Date().toISOString()} - Error Response` // from ${targetUrl}`
        )
        console.log('Status:', error.response.status)
        console.info('Body:', JSON.stringify(error.response.data, null, 2))
      }
      // Forward the error response from the target server
      res.status(error.response.status).send(error.response.data)
    } else {
      res.status(500).send('Error forwarding request')
    }
  }
}

app.all('*', forwardRequest)

app.listen(PORT, () => {
  console.log(`Voiceflow Analytics Proxy Server is listening on port ${PORT}`)
})

function extractTraceInfo(trace, requestBody, requestHeaders) {
  // Parse request headers
  var ua = new parser(requestHeaders['user-agent'])
  let hDevice = ua.getDevice() || null
  if (hDevice) {
    hDevice = `${hDevice.vendor} ${hDevice.model}`
  }
  let hBrowser = ua.getBrowser() || null
  if (hBrowser) {
    hBrowser = `${hBrowser.name} ${hBrowser.version}`
  }
  let hOS = ua.getOS() || null
  if (hOS) {
    hOS = `${hOS.name} ${hOS.version}`
  }
  let hSession = requestHeaders.sessionid || null
  let hVersion = requestHeaders.versionid || null
  let hOrigin = requestHeaders.origin || null
  let hReferer = requestHeaders.referer || null
  let hIP = requestHeaders['x-forwarded-for'] || '127.0.0.1'

  // Initialize the output object with null values
  const output = {
    headers: {
      os: hOS,
      device: hDevice,
      browser: hBrowser,
      origin: hOrigin,
      referer: hReferer,
      // ip: hIP,
      session: hSession,
      version: hVersion,
    },
    actionType: null,
    actionValue: null,
    matchedIntent: null,
    confidence: null,
    model: null,
    tokenConsumption: {
      total: 0,
      query: 0,
      answer: 0,
    },
    apiCalls: {
      total: 0,
      successful: 0,
      failed: 0,
    },
    textResponses: [],
    endOfConvo: false,
  }

  // Extract action type and value from the request body
  if (requestBody && requestBody.action) {
    output.actionType = requestBody.action.type
    // Check if the action is a button click and extract the label, otherwise extract the payload
    if (
      requestBody.action.type.startsWith('path-') &&
      requestBody.action.payload &&
      requestBody.action.payload.label
    ) {
      output.actionValue = requestBody.action.payload.label
    } else {
      output.actionValue = requestBody.action.payload
    }
  }

  // Iterate over each trace item
  trace.forEach((item) => {
    if (item.type === 'end') {
      output.endOfConvo = true
    }
    if (item.type === 'text' && item.payload && item.payload.message) {
      output.textResponses.push(item.payload.message)
    }
    if (item.type === 'debug') {
      if (item.payload.type === 'api') {
        output.apiCalls.total += 1
        if (item.payload.message === 'API call successfully triggered') {
          output.apiCalls.successful += 1
        } else {
          output.apiCalls.failed += 1
        }
      }
      if (item.payload.type === 'intent') {
        const intentMatch = item.payload.message.match(
          /matched intent \*\*(.*?)\*\* - confidence interval _(.*?)%_/
        )
        if (intentMatch) {
          output.matchedIntent = intentMatch[1]
          output.confidence = parseFloat(intentMatch[2])
        }
      }
      if (item.payload.type === 'intent') {
        const intentMatch = item.payload.message.match(
          /matched intent \*\*(.*?)\*\* - confidence interval _(.*?)%_/
        )
        if (intentMatch) {
          output.matchedIntent = intentMatch[1]
          output.confidence = parseFloat(intentMatch[2])
        }
      }
      // For AI Set messages, extract model and post multiplier token consumption
      if (item.payload.message.includes('__AI Set__')) {
        const modelMatch = item.payload.message.match(/Model: `(.*?)`/)
        const postMultiplierMatch = item.payload.message.match(
          /Post-Multiplier Token Consumption: `{(.*?)}`/
        )
        if (modelMatch) {
          output.model = modelMatch[1]
        }
        if (postMultiplierMatch) {
          // Attempt to transform the matched string into a valid JSON format
          const formattedString = postMultiplierMatch[1]
            .replace(/`/g, '"')
            .replace(/(\w+):/g, '"$1":')

          const consumptionData = `{${formattedString}}`

          try {
            const consumptionJson = JSON.parse(consumptionData)
            output.tokenConsumption.total += consumptionJson.total || 0
            output.tokenConsumption.query += consumptionJson.query || 0
            output.tokenConsumption.answer += consumptionJson.answer || 0
          } catch (error) {
            console.error(
              'Error parsing post multiplier token consumption data:',
              error
            )
          }
        }
      }

      // For AI Response messages, extract model and post multiplier token consumption
      if (item.payload.message.includes('__AI Response__')) {
        const modelMatch = item.payload.message.match(/Model: `(.*?)`/)
        const postMultiplierMatch = item.payload.message.match(
          /Post-Multiplier Token Consumption: `{(.*?)}`/
        )
        if (modelMatch) {
          output.model = modelMatch[1]
        }
        if (postMultiplierMatch) {
          // Attempt to transform the matched string into a valid JSON format
          const formattedString = postMultiplierMatch[1]
            .replace(/`/g, '"')
            .replace(/(\w+):/g, '"$1":')

          const consumptionData = `{${formattedString}}`

          try {
            const consumptionJson = JSON.parse(consumptionData)
            output.tokenConsumption.total += consumptionJson.total || 0
            output.tokenConsumption.query += consumptionJson.query || 0
            output.tokenConsumption.answer += consumptionJson.answer || 0
          } catch (error) {
            console.error(
              'Error parsing post multiplier token consumption data:',
              error
            )
          }
        }
      }
    }
  })
  return output
}
