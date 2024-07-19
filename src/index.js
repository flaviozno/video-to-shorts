import downloadService from "./services/downloadService.js";
import ffmpegService from "./services/ffmpegService.js";
import { Whisper } from "./services/whisper.js";
import path from "path";
import { fileURLToPath } from "url";

const main = async () => {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  try {
    const download = new downloadService(
      "https://www.youtube.com/@theblacklistemportugues/videos",
      dir
    );
    const ffmpeg = new ffmpegService(dir);

    let latestVideoId = await download.getLatestVideo();
    let details = await download.getVideoDetails(latestVideoId);
    console.log(details);
    const [outputVideo, outputAudio] = await Promise.all([
      download.downloadVideo(latestVideoId),
      download.downloadAudio(latestVideoId),
    ]);
    const srtPath = latestVideoId + "-audio.json";
    console.log("whisper starts");
    await Whisper(outputAudio, path.join(dir, "transcription"));
    console.log("whisper end");
    console.log("resize starts");
    const resizeVideoPath = await ffmpeg.resize(outputVideo);
    console.log("resize end");
    console.log("sync audio starts");
    const syncedVideoPath = await ffmpeg.syncAudio(
      resizeVideoPath,
      outputAudio
    );
    console.log("sync audio end");

    console.log("split video starts");
    await ffmpeg.splitVideo(
      syncedVideoPath,
      srtPath,
      latestVideoId,
      details.channelName
    );
    console.log("split video end");
    await download.removeFilesByName(latestVideoId);
  } catch (error) {
    console.error("Erro durante o processamento:", error);
  }
};

main();
