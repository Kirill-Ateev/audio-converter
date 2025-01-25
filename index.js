import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';

// Установка пути к FFmpeg бинарнику
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const INPUT_ROOT = 'input';
const OUTPUT_ROOT = 'output';

// Рекурсивный поиск файлов
async function findAudioFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let results = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(await findAudioFiles(fullPath));
    } else if (entry.isFile() && path.extname(entry.name) === '.m4a') {
      results.push(fullPath);
    }
  }

  return results;
}

// Создание директорий если не существуют
function ensureDirectoryExistence(filePath) {
  const dirname = path.dirname(filePath);
  if (fs.existsSync(dirname)) return true;
  ensureDirectoryExistence(dirname);
  fs.mkdirSync(dirname);
}

// Конвертация файла
function convertFile(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      // .audioFilters([           // Опциональные настройки для улучшения транскрибации
      //     'highpass=f=300',     // убрать низкочастотный шум
      //     'lowpass=f=3400',     // обрезать выше речевого диапазона
      //     'loudnorm=I=-16'      // нормализация громкости
      //   ])
      .audioFrequency(16000)
      .audioChannels(1)
      .audioCodec('pcm_s16le')
      .format('wav')
      .on('start', (commandLine) => {
        console.log(`Processing: ${inputPath}`);
      })
      .on('progress', (progress) => {
        console.log(`Progress: ${Math.round(progress.percent)}% done`);
      })
      .on('error', (err) => {
        console.error(`Error processing ${inputPath}:`, err);
        reject(err);
      })
      .on('end', () => {
        console.log(`Completed: ${outputPath}`);
        resolve();
      })
      .save(outputPath);
  });
}

async function main() {
  try {
    const files = await findAudioFiles(INPUT_ROOT);

    for (const inputPath of files) {
      const relativePath = path.relative(INPUT_ROOT, inputPath);
      const outputPath = path.join(
        OUTPUT_ROOT,
        relativePath.replace(/\.m4a$/, '.wav')
      );

      ensureDirectoryExistence(outputPath);
      await convertFile(inputPath, outputPath);
    }

    console.log('All files processed successfully');
  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  }
}

main();
