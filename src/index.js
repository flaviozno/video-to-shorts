import downloadService from "./services/downloadService.js";
import ffmpegService from "./services/ffmpegService.js";
import path from "path";
import { fileURLToPath } from "url";

const main = async () => {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  try {
    const download = new downloadService(
      "https://www.youtube.com/@ossocios",
      dir
    );
    const ffmpeg = new ffmpegService(dir);

    let latestVideoId = await download.getLatestVideo();
    latestVideoId = "hsZVlDQEwnI";
    let details = await download.getVideoDetails(latestVideoId);
    const [outputVideo, outputAudio] = await Promise.all([
      download.downloadVideo(latestVideoId),
      download.downloadAudio(latestVideoId),
    ]);

    const resizeVideoPath = await ffmpeg.resize(outputVideo);

    const syncedVideoPath = await ffmpeg.syncAudio(
      resizeVideoPath,
      outputAudio
    );

    await ffmpeg.splitVideo(syncedVideoPath, outputAudio);

    await download.removeFilesByName(latestVideoId);
  } catch (error) {
    console.error("Erro durante o processamento:", error);
  }
};

main();
