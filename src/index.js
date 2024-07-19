import downloadService from "./services/downloadService.js";
import uploadService from "./services/uploadService.js";
import ffmpegService from "./services/ffmpegService.js";
import oauthService from "./services/oauthService.js";
import { Whisper } from "./services/whisper.js";
import path from "path";
import { fileURLToPath } from "url";

const main = async () => {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  try {
    const oauth = new oauthService(dir);
    await oauth.init();
    const upload = new uploadService(dir, oauth.youtube);

    const download = new downloadService(
      "https://www.youtube.com/@ossocios/videos",
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
    let shortName = latestVideoId + "_" + details.channelName;
    let shortsCount = await ffmpeg.splitVideo(
      syncedVideoPath,
      srtPath,
      shortName
    );
    console.log("split video end");
    console.log("upload videos starts");
    for (let i = 0; i < shortsCount; i++) {
      await upload.uploadVideo(
        `${shortName}_${i + 1}.mp4`,
        `Já imaginou libertar o cérebro do corpo e alcançar a imortalidade? 🌟 Dr. Kutchera, seu brilhantismo em teoria dos números é inigualável. Nesta jornada, você não apenas andará e falará com facilidade, mas também poderá cantar e dançar novamente. Vamos juntos tocar o rosto de Deus e explorar os limites da nossa existência. Prepare-se para uma viagem emocionante, onde mente e conhecimento são nossos maiores tesouros. 🌌🔬. ⚠️⚠️ Esse vídeo foi gerado por uma IA e um código em NODEJS apenas para questões de APRENDIZADO!!! Esse canal, NÃO sera MONETIZADO e todos os CRÉDITOS são de ${details.channelName} pelo EP: ${details.title}⚠️⚠️`,
        `Shorts de  ${details.channelName}.`,
        details.tags,
        "public"
      );
    }
    console.log("upload videos end");
    await download.removeFilesByName(latestVideoId);
  } catch (error) {
    console.error("Erro durante o processamento:", error);
  }
};

main();
