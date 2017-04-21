const http = require('http');
const request = require('request');
const fs = require('fs');
const config = require('./config');

const variants = Object.keys(config.VARIANTS);
const agents = Object.keys(config.USER_AGENTS);
const lastFont = agents.length * variants.length;
const fontRegExp = /url\(([^\)]*?)\)/m;
let sourceMap = {};
let counterFonts = 0;

let fontDir = './fonts/';
let scssDir = './scss/';
if (!fs.existsSync(fontDir)) fs.mkdirSync(fontDir);
else {
    fs.readdirSync(fontDir).forEach( (file) => {
       fs.unlinkSync(fontDir + '/' + file); 
    });
}
if (!fs.existsSync('./scss/')) fs.mkdirSync('./scss/');
else {
    fs.readdirSync(scssDir).forEach( (file) => {
       fs.unlinkSync(scssDir + '/' + file); 
    });
}

for (let i = 0; i < variants.length; i++) {
    let fontFamily = config.FAMILY + '-' + config.VARIANTS[variants[i]];
    sourceMap[fontFamily] = {};
    sourceMap[fontFamily].weight = variants[i];
    sourceMap[fontFamily].style = config.VARIANTS[variants[i]];
    for (let k = 0; k < agents.length; k++) {
        getResponce(variants[i], agents[k], fontFamily);
    }
}

function getResponce(idVariant, idFormat, fontFamily) {
    let req = http.request({
        hostname: 'fonts.googleapis.com',
        method: 'GET',
        port: 80,
        path: '/css?family=' + config.FAMILY + ":" + config.VARIANTS[idVariant] + '&subset=' + config.SUBSETS,
        headers: {
            'User-Agent': config.USER_AGENTS[idFormat]
        }
    }, (res) => {
        let output;
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
            output += chunk;
        });
        res.on('end', () => {
            let result = fontRegExp.exec(output) ? fontRegExp.exec(output)[1] : null;
            let fontname = config.FAMILY.toLowerCase() + '-' + config.VARIANTS[idVariant].toLowerCase();

            if (result) {
                let filename;
                if (idFormat === 'svg') {
                    filename = (/kit=(.*?)&/).exec(result)[1] + '.svg';
                } else {
                    filename = (/v16\/(.*)/).exec(result)[1];
                }
                request(result).pipe(fs.createWriteStream('./fonts/' + filename));
                sourceMap[fontFamily][idFormat] = filename;
                counterFonts++;
                if (counterFonts === lastFont) {
                    fontArr = Object.keys(sourceMap);
                    for (let i = 0; i < fontArr.length; i++) {
                        let scss = `@font-face {\n\tfont-family:"${fontArr[i]}";\n`;
                        let fontFamilyArr = Object.keys(sourceMap[fontArr[i]]);
                        for (let k = 0; k < fontFamilyArr.length; k++) {
                            if(fontFamilyArr[k] === 'weight' || fontFamilyArr[k] === 'style') continue;
                            scss += `\tsrc: url("../fonts/${sourceMap[fontArr[i]][fontFamilyArr[k]]}") format("${fontFamilyArr[k]}");\n`
                        }
                        let style;
                        if (sourceMap[fontArr[i]].style.indexOf('Italic') !== -1) style = 'italic';
                        else style = 'normal';

                        scss += `\tfont-weight: ${sourceMap[fontArr[i]].weight};\n\tfont-style: ${style};\n}`;
                        fontname = fontArr[i].toLowerCase();
                        fs.writeFile('./scss/' + fontname + '.scss', scss);
                        fs.appendFile('./scss/roboto.scss', `@import "${fontname}";\n`)
                    }
                }
            }
        });
    });
    req.end();
}