# Voiceflow Analytics Proxy

## Overview

This repository contains a Node.js application that acts as a proxy between a Chat Widget and the Voiceflow Dialog Manager (DM) API. The primary purpose of this proxy is to intercept requests sent from the Chat Widget to the Voiceflow DM API's `/interact` endpoint, allowing for the collection, parsing, and analysis of response traces for analytics purposes.

## Features

- **Request Interception**: Captures all requests sent by the Chat Widget to the Voiceflow DM API.
- **Response Parsing**: Analyzes the traces from the responses to extract valuable analytics data.

## Prerequisites

Before setting up the project, ensure you have the following installed on your system:

- Node.js (v18.x or higher recommended)
- npm (usually comes with Node.js)

## Setup Instructions

### 1. Clone the Repository

Clone this repository to your local machine using Git:

```bash
git clone <repository-url>
```

Navigate into the project directory:

```bash
cd <project-directory>
```

### 2. Configure Environment Variables

Rename the `.env.template` file to `.env`. Open the `.env` file and update the values if necessary.

The default configuration is as follows:

```
VOICEFLOW_RUNTIME_URL = 'https://general-runtime.voiceflow.com' # Default for public runtime
PORT = 3000 # Port to run the server on
```

### 3. Install Dependencies

Install the necessary Node.js dependencies using npm:

```bash
npm install
```

### 4. Start the Proxy Server

Run the following command to start the proxy server:

```bash
npm start
```

### 5. Expose the Server (Optional)

If running locally and you wish to expose the server to the internet, you can use `ngrok` to create a forwarding URL.

For example, if the server is running on port 3000:

```bash
ngrok http 3000
```

### 6. Update the Chat Widget Snippet

Update the `url` value in your Chat Widget snippet code to use the URL of the instance where the proxy is running or the ngrok forwarding URL.

Here is an example snippet:

```html
(function(d, t) {
  var v = d.createElement(t), s = d.getElementsByTagName(t)[0];
  v.onload = function() {
    window.voiceflow.chat.load({
      verify: { projectID: 'your-vf-roject-id' },
      url: 'https://your-proxy-url',
      versionID: 'development' // Use 'production' for production environments
    });
  }
  v.src = "https://cdn.voiceflow.com/widget/bundle.mjs"; v.type = "text/javascript"; s.parentNode.insertBefore(v, s);
})(document, 'script');
```

Replace `your-vf-roject-idReplace` with your project id and `https://your-proxy-url` with the actual URL of your proxy server instance.

