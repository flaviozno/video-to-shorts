import express from "express";
import { google } from "googleapis";
import fs from "fs";
import path from "path";
const OAuth2 = google.auth.OAuth2;

class oauthService {
  constructor(dirname) {
    this.__dirname = dirname;
    this.port = 5000;
    this.app;
    this.server;
    this.oauth2Client;
    this.token;
    this.youtube = google.youtube({ version: "v3" });
  }

  async init() {
    return new Promise(async (resolve, reject) => {
      try {
        await this.startServer();
        await this.createOAuthClient();
        this.requestUser();
        await this.callBack();
        await Promise.all([
          this.getAccessTokens(),
          this.setGlobal(),
          this.closeServer(),
        ]);
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }
  async startServer() {
    return new Promise((resolve, reject) => {
      this.app = express();
      this.server = this.app.listen(this.port, () =>
        console.log("Server is running on port " + this.port)
      );
      resolve();
    });
  }

  async createOAuthClient() {
    return new Promise((resolve, reject) => {
      const credentials = fs.readFileSync(
        path.join(this.__dirname, "credentials/youtube.json"),
        "utf8"
      );

      this.oauth2Client = new OAuth2(
        JSON.parse(credentials).web.client_id,
        JSON.parse(credentials).web.client_secret,
        JSON.parse(credentials).web.redirect_uris[0]
      );
      resolve();
    });
  }
  requestUser() {
    const url = this.oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: ["https://www.googleapis.com/auth/youtube"],
    });
    console.log("Authorize this app by visiting this url:", url);
  }

  async callBack() {
    return new Promise((resolve, reject) => {
      console.log("Waiting for user OAuth...");

      this.app.get("/oauth2callback", (req, res) => {
        this.token = req.query.code;
        res.send("OK!");
        resolve();
      });
    });
  }

  async getAccessTokens() {
    return new Promise((resolve, reject) => {
      this.oauth2Client.getToken(this.token, (error, tokens) => {
        if (error) return reject(error);

        console.log("Token retrieved");
        this.oauth2Client.setCredentials(tokens);
        resolve();
      });
    });
  }

  async setGlobal() {
    google.options({
      auth: this.oauth2Client,
    });
  }

  async closeServer() {
    return new Promise((resolve, reject) => {
      this.server.close(() => {
        resolve();
      });
    });
  }
}

export default oauthService;
