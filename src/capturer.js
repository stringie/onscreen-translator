const { recognize } = require("node-tesseract-ocr");
const translate = require("./translate");
const pixelmatch = require("pixelmatch");
const ss = require("screenshot-desktop");
const cropper = require("png-crop");
const { remote, shell } = require('electron');
const { screen } = remote;
const { PNG } = require("pngjs");
const path = require('path');
const fs = require('fs')
const langs = require('./languages');
const os = require('os');

document.getElementById('capture').addEventListener('click', () => {
  crop().then(currImage => {
    capture(path.join(os.tmpdir(), 'translator-screenshot.png'), currImage);
  }); 
});

let captureInterval = null;
document.getElementById("capture-cont").addEventListener("click", () => {
  captureInterval = setInterval(() => {
    const screenshotPath = path.join(os.tmpdir(), 'translator-screenshot.png');
    const translationBox = document.getElementById("translation");

    translationBox.style.display = "none";
    crop(translationBox).then(currImage => {
      if (!fs.existsSync(screenshotPath)) {
        capture(screenshotPath, currImage);
      } else {
        const screenshot = PNG.sync.read(fs.readFileSync(screenshotPath));
        const {width, height} = screenshot;
        if (pixelmatch(screenshot.data, currImage.data, null, width, height) > 10) {
          capture(screenshotPath, currImage);
        }
      }
    });
  }, 5000);
});

document.getElementById("clear").addEventListener("click", () => {
  var translationBox = document.getElementById("translation");
  translationBox.style.display = "none";
  if (captureInterval) {
    clearInterval(captureInterval);
  }
});

document.getElementById("close").addEventListener("click", () => {
  fs.unlink(path.join(os.tmpdir(), 'translator-screenshot.png'), (err) => {
    if (err) {
      console.log(err);
    }
  });
  remote.getCurrentWindow().close();
});

const langSelector = document.getElementById("langs");
langs.getTesseractLangs().then(langArr => {
  let langOptions = "";
  langArr.forEach(lang => {
    const l = lang.trim();
    if (l && l !== 'osd') {
      langOptions += `<option value="${l}" ${l == 'eng' ? "selected" : ""} >${l}</option>`;
    }
  });

  langSelector.innerHTML = langOptions;
})

function capture(screenshotPath, currImage) {
  fs.writeFile(screenshotPath, PNG.sync.write(currImage), (error) => {
    if (error) return console.log(error);
    // shell.openPath("file://" + screenshotPath);
    try {
      recognize(screenshotPath, {lang: langSelector.options[langSelector.selectedIndex].value}).then(ocrResult => {
        console.log(ocrResult);
        translate(ocrResult).then(translation => {
          displayTranslation(translation.text);
        });
      });
    } catch (error) {
      console.log(error);
    }
  });
}

function displayTranslation(text) {
  var translationBox = document.getElementById("translation");
  
  translationBox.style.display = "block";
  translationBox.innerHTML = text;
}

function getBounds() {
  const bounds = remote.getCurrentWindow().getBounds();
  var scale = screen.getPrimaryDisplay().scaleFactor;
  return {width: (bounds.width - 10)*scale, height: (bounds.height - 25)*scale, top: (bounds.y + 21)*scale, left: (bounds.x + 5)*scale};
}

function crop(translationBox) {
  return new Promise((resolve, reject) => {
    ss({format: "png", filename: path.join(os.tmpdir(), 'translator.png')}).then(img => {
      if (translationBox && translationBox.innerHTML) {
        document.getElementById("translation").style.display = "block";
      }
      cropper.cropToStream(img, getBounds(), function(err, stream) {
        if (err) throw err;
        resolve(stream);
      })
    })
  })
}