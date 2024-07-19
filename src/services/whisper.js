import { exec } from "child_process";

export const Whisper = (audioPath, outputPath) => {
  return new Promise((resolve, reject) => {
    let command = `C:\\Users\\flavi\\AppData\\Local\\Packages\\PythonSoftwareFoundation.Python.3.10_qbz5n2kfra8p0\\LocalCache\\local-packages\\Python310\\Scripts\\whisper.exe ${audioPath} --language "Portuguese" --output_dir ${outputPath} --output_format json`;

    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Erro ao executar o comando: ${error.message}`);
        reject()
        return;
      }

      if (stderr) {
        console.error(`Erro no comando: ${stderr}`);
        return;
      }

      console.log("End whisper process");
      resolve()
    });
  });
};
