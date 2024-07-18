import puppeteer from "puppeteer";
import youtubedl from "youtube-dl-exec";
import path from "path";
import fs from "fs";

class downloadService {
  constructor(channelUrl, dirname) {
    this.__dirname = dirname;
    this.channelUrl = channelUrl;
  }

  removeFilesByName(name) {
    const dir = path.resolve(this.__dirname, "download");
    return new Promise((resolve, reject) => {
      fs.readdir(dir, (err, files) => {
        if (err) {
          reject(`Error reading directory: ${err}`);
          return;
        }

        const deletePromises = files
          .filter((file) => file.startsWith(name))
          .map((file) => {
            const filePath = path.join(dir, file);
            return new Promise((resolve, reject) => {
              fs.unlink(filePath, (err) => {
                if (err) {
                  reject(`Error deleting file ${filePath}: ${err}`);
                  return;
                }
                resolve();
              });
            });
          });

        Promise.all(deletePromises)
          .then(() => resolve("All matching files removed successfully."))
          .catch((err) => reject(err));
      });
    });
  }
  async getVideoDetails(videoId) {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    await page.goto(videoUrl);

    await page.waitForSelector(".style-scope.ytd-watch-metadata");
    await page.waitForSelector(".style-scope.ytd-video-owner-renderer");

    const details = await page.evaluate(() => {
      const title = document
        .getElementsByClassName("style-scope ytd-watch-metadata")[0]
        .querySelector("div")
        .querySelector("h1").innerText;
      const channelName = document
        .getElementsByClassName("style-scope ytd-video-owner-renderer")[2]
        .querySelector("div")
        .querySelector("div")
        .querySelector("a").innerText;
      const description = document.querySelector("#description").innerText;
      const tags = Array.from(
        document.querySelectorAll("meta[property='og:video:tag']")
      ).map((tag) => tag.content);

      return { title, channelName, description, tags };
    });

    await browser.close();
    return details;
  }
  async getLatestVideo() {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(this.channelUrl);

    await page.waitForSelector("ytd-rich-grid-renderer");

    const videoId = await page.evaluate(() => {
      return document
        .querySelector("ytd-rich-grid-media a#thumbnail")
        .href.split("v=")[1];
    });

    await browser.close();
    return videoId;
  }

  async downloadVideo(videoId) {
    try {
      const url = `https://www.youtube.com/watch?v=${videoId}`;
      const downloadDir = path.resolve(this.__dirname, "download");

      if (!fs.existsSync(downloadDir)) {
        fs.mkdirSync(downloadDir);
      }

      const outputVideo = path.join(downloadDir, `${videoId}.mp4`);

      await youtubedl(url, {
        output: outputVideo,
        format: "bestvideo",
      });

      return outputVideo;
    } catch (error) {
      console.error("Error downloading video:", error);
      throw error;
    }
  }

  async downloadAudio(videoId) {
    try {
      const url = `https://www.youtube.com/watch?v=${videoId}`;
      const downloadDir = path.resolve(this.__dirname, "download");

      if (!fs.existsSync(downloadDir)) {
        fs.mkdirSync(downloadDir);
      }

      const outputAudio = path.join(downloadDir, `${videoId}-audio.mp4`);

      await youtubedl(url, {
        output: outputAudio,
        format: "bestaudio",
      });

      return outputAudio;
    } catch (error) {
      console.error("Error downloading audio:", error);
      throw error;
    }
  }
}

export default downloadService;
