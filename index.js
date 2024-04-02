const fs = require("fs").promises;
const path = require("path");
const process = require("process");
const { authenticate } = require("@google-cloud/local-auth");
const { google } = require("googleapis");

// If modifying these scopes, delete token.json.
const SCOPES = ["https://www.googleapis.com/auth/drive.metadata.readonly"];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = path.join(process.cwd(), "token.json");
const CREDENTIALS_PATH = path.join(process.cwd(), "credentials.json");

/**
 * Reads previously authorized credentials from the save file.
 *
 * @return {Promise<OAuth2Client|null>}
 */
async function loadSavedCredentialsIfExist() {
  try {
    const content = await fs.readFile(TOKEN_PATH);
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials);
  } catch (err) {
    return null;
  }
}

/**
 * Serializes credentials to a file compatible with GoogleAuth.fromJSON.
 *
 * @param {OAuth2Client} client
 * @return {Promise<void>}
 */
async function saveCredentials(client) {
  const content = await fs.readFile(CREDENTIALS_PATH);
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;
  const payload = JSON.stringify({
    type: "authorized_user",
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  await fs.writeFile(TOKEN_PATH, payload);
}

/**
 * Load or request or authorization to call APIs.
 *
 */
async function authorize() {
  let client = await loadSavedCredentialsIfExist();
  if (client) {
    return client;
  }
  client = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  });
  if (client.credentials) {
    await saveCredentials(client);
  }
  return client;
}

/**
 * Lists the names and IDs of up to 10 files.
 * @param {OAuth2Client} authClient An authorized OAuth2 client.
 */

let video = [];
async function listFiles(authClient) {
  const drive = google.drive({ version: "v3", auth: authClient });
  const res = await drive.files.list({
    pageSize: 10,
    fields: "nextPageToken, files(*)",
  });
  const files = res.data.files;
  // console.log(files);
  if (files.length === 0) {
    console.log("No files found.");
    return;
  }

  files.map((item, index) => {
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    if (item.size === 0) return "n/a";
    const i = parseInt(Math.floor(Math.log(item.size) / Math.log(1024)), 10);
    if (i === 0) return `${item.size} ${sizes[i]})`;
    let sizeCV = `${(item.size / 1024 ** i).toFixed(1)} ${sizes[i]}`;

    video.push({
      name: item.name,
      size: sizeCV,
      webViewLink: item.webViewLink,
    });
  });
}

authorize().then(listFiles).catch(console.error);

const https = require("http");
const port = 3000;

const server = https.createServer(function (req, res) {
  res.writeHead(200, { "Content-Type": "text/plain" });
  const myJSON = JSON.stringify(video);
  res.write(myJSON);
  res.end();
});
server.listen(port, function (error) {
  if (error) throw error;
  console.log("Server listening on port %s", port);
});
