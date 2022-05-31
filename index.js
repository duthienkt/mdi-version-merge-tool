const fs = require('fs');
const path = require('path');
const webfont = require("webfont").default;

const hs = [10000, 100, 1];
const version2num = text => text.split('.').reduce((ac, x, i) => ac + x * hs[i])
const fontRgx = /"..\/fonts\/[^"]+"/g;

let readContent = (mdiDir) => {
    let version = JSON.parse(fs.readFileSync(path.join(mdiDir, 'package.json'), "utf-8")).version;
    let cssText = fs.readFileSync(path.join(mdiDir, 'css', 'materialdesignicons.css'), 'utf-8');
    let iconRgx = /\.mdi-(.+)::before\s*{[^}]+content:\s*"([^"]+)"[^}]*}/gm;
    let matched;
    var icons = [];
    matched = iconRgx.exec(cssText);
    while (matched) {
        icons.push({
            name: matched[1],
            content: matched[2]
        });
        matched = iconRgx.exec(cssText);
    }
    return {
        version,
        cssText,
        dir: mdiDir,
        icons
    };
}

if (!fs.existsSync('output')){
    fs.mkdirSync('output');
}
let dirs = fs.readdirSync('repo')
dirs = dirs.filter((dir) => fs.statSync(path.join('repo', dir)).isDirectory());


let mdiContents = dirs.map(dir => readContent(path.join('repo', dir)));
mdiContents.sort((a, b) => version2num(b.version) - version2num(a.version));

let pushedIcon = {};
let outCss = '';
let outJS = '';
let outIcons = [];
mdiContents.forEach((content, i) => {
    let icons;
    let cssText = i === 0 ? content.cssText : `@font-face {
  font-family: "MDI_${content.version.replace(/\./g, '_')}";
  src: url("../fonts/materialdesignicons-webfont.eot?v=${content.version}");
  src: url("../fonts/materialdesignicons-webfont.eot?#iefix&v=${content.version}") format("embedded-opentype"), url("../fonts/materialdesignicons-webfont.woff2?v=${content.version}") format("woff2"), url("../fonts/materialdesignicons-webfont.woff?v=${content.version}") format("woff"), url("../fonts/materialdesignicons-webfont.ttf?v=${content.version}") format("truetype");
  font-weight: normal;
  font-style: normal;
}`;

    cssText = cssText.replace(fontRgx, (substring) => substring.replace('../fonts/materialdesignicons-webfont.',
        `./materialdesignicons-webfont_${content.version.replace(/\./g, '_')}.`));


    if (i === 0) {
        icons = content.icons;
        outJS += `var version = ${JSON.stringify(content.version)};\n`;
        outCss += cssText + '\n\n';

    }
    else {
        icons = content.icons.filter(icon => !pushedIcon[icon.name]);
        if (icons.length === 0) return;
        outCss += cssText + '\n\n';
        let selector = icons.map(icon => `.mdi-${icon.name}::before`).join(',\n');
        outCss += `\n${selector}{
  font: normal normal normal 24px/1 "MDI_${content.version.replace(/\./g, '_')}";        
}\n`;
        //font-family: "MDI_${content.version.replace(/\./g, '_')}";
        icons.forEach(icon => {
            outCss += `\n.mdi-${icon.name}::before {
  content: "${icon.content}";
}\n`;
        });
    }

    ['eot', 'ttf', 'woff', 'woff2'].forEach(ext => {
        let source = path.join(content.dir, 'fonts',
            `../fonts/materialdesignicons-webfont.${ext}`);
        let dest = path.join('output', `./materialdesignicons-webfont_${content.version.replace(/\./g, '_')}.${ext}`);
        fs.copyFile(source, dest, () => {
        });
    });

    icons.forEach(icon => pushedIcon[icon.name] = true);
    icons.forEach(icon => {
        outIcons.push({
            hex: icon.content.substring(1).toUpperCase(),
            name: icon.name,
            isNew: i === 0
        })
    });
});
outJS += 'var icons = ';
outJS += JSON.stringify(outIcons, null, 2);
outJS += ';';



fs.copyFile('template/index.html', 'output/index.html', () => {
});


webfont({
    files: "svg/*.svg",
    fontName: "materialdesignicons-extended-webfont",
    // templateFontName: 'Material Design Icons Extended',
    templateClassName: 'mdi',
    template: "template/template.css.njk",
    glyphTransformFn: (obj) => {

        return obj;
    }
})
    .then((result) => {
        let icons = result.glyphsData.map(data => {
            return {
                name: data.metadata.name,
                content: '\\' + data.metadata.unicode[0].charCodeAt(0).toString(16)
            }
        }).filter(icon => !pushedIcon[icon.name]);
        icons.forEach(icon => pushedIcon[icon.name] = true);
        icons.forEach(icon => {
            outIcons.push({
                hex: icon.content.substring(1).toUpperCase(),
                name: icon.name,
                isNew: true
            })
        });

        if (icons.length > 0) {
            ['eot', 'ttf', 'woff', 'woff2'].forEach(function (ext) {
                fs.writeFile(path.join('output', "materialdesignicons-extended-webfont." + ext), result[ext], function (err) {
                    if (err) console.error(err);
                });
            });

            outCss += '\n\n' + result.template;
        }
        fs.writeFile(path.join('output', 'materialdesignicons.css'), outCss, 'utf-8', function (err) {
            if (err) console.error(err);
        });


        fs.writeFile(path.join('output', 'icons.js'), outJS, function (err) {
            if (err) console.error(err);
        });
        return result;
    })
    .catch((error) => {
        throw error;
    });
