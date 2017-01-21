/*
The MIT License (MIT)

Copyright (c) 2016 Stephen Tuso

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

var fs = require('fs');
var path = require('path');
var child_process = require('child_process');

var workingDir = process.argv[2];

if (workingDir == null) {
    console.error("Please pass a working directory");
    process.exit(1);
}

var reposDir = path.join(workingDir, 'repos');
var outDir = path.join(workingDir, 'out');

var sourceList = require(path.join(workingDir, 'sources.json'));

/* Exported object */
var licensesHtmlGenerator = {

    generateHtml: function() {

        child_process.execSync('mkdir -p ' + reposDir);
        child_process.execSync('mkdir -p ' + outDir);

        console.log("\nCloning repos...")
        for (var i = 0; i < sourceList.length; i++) {
            var source = sourceList[i];
            var uri = source.uri || source.url;
            if (!isGitRepoUrl(uri)) {
                continue;
            }
            var cmd = 'git clone --depth 1 ' + uri;
            console.log("\n" + cmd);
            try {
                child_process.execSync(cmd, {
                    "cwd" : reposDir
                });
            } catch (e) {
                //Probably failed because repo dir is not empty
                console.log("Delete " + path.join(reposDir, getRepoDirFromUrl(uri)) + " to download the repo again.");
            }

        }

        var files = fs.readdirSync(reposDir);
        var html = "<!DOCTYPE html>\n<html>\n<head>" + readTemplateFile('head.html') + "\n<style>" + readTemplateFile('default-styles.css') + readTemplateFile('styles.css') + "</style>\n</head>\n<body><div class=\"content\">\n\t"

        var header = readTemplateFile('header.html');
        if (header != null && header != '') {
            html += "\t<header>\n\t" + header + "\n\t</header>\n\t<hr/>\n";
        }

        console.log("\n");
        for (var i = 0; i < sourceList.length; i++) {

            var source = sourceList[i];
            console.log("Generating HTML for " + source.name);

            var licenseString = getLicenseStringFromSource(source);

            if (licenseString == null) {
                console.error("\nERROR:\nUnable to find license for " + source.name);
                continue;
            }
            if (i > 0) {
                html += "\t<hr>\n";
            }
            html += "\t" + getLicenseHeader(source.name) + "\n";
            html += '\t<div class="license">' + getHtmlForLicenseString(licenseString) + '\n</div>\n'
        }

        html += "</div>\n";

        var footer = readTemplateFile("footer.html");
        if (footer != null && footer != "") {
            html += "<footer>\n<hr>\n" + footer + "\n</footer>\n";
        }
        html += "</body>\n</html>";

        var outPath = path.join(outDir, "licenses.html");
        fs.writeFileSync(outPath, html, 'utf8');
        console.log("\n----------\nDone. Html licenses file located at " + outPath + "\n");

    }

}

function isGitRepoUrl(url) {
    return url.startsWith('http');
}

function getLicenseHeader(name) {
    var template = readTemplateFile('license-header.html');
    return template.replace(/<!--NAME-->/g, name);
}

function readTemplateFile(name) {
    try {
        return fs.readFileSync(path.join(workingDir, 'templates', name), 'utf8');
    } catch (e) {
        return fs.readFileSync(path.join(__dirname, 'templates', name), 'utf8');
    }
}

function getLicenseStringFromSource(source) {
    if (isGitRepoUrl(source.uri)) {
        var dir = getRepoDirFromUrl(source.uri);
        return getLicenseFromPath(path.join(reposDir, dir));
    }

    try {
        var uri = source.uri;
        if (uri.match(/^(?:\.|[^\/])/)) {
            uri = uri.replace('./', '');
            uri = path.join(workingDir, uri);
        }
        return fs.readFileSync(uri, 'utf8');
    } catch (e) {
        return null;
    }

}

function getRepoDirFromUrl(url) {
    return url.match(/[^\/]*?(?=.git$|$)/) + '';
}

function getLicenseFromPath(dir) {
    var licenseFileString = readLicenseFile(dir);
    var license = null;
    if (licenseFileString != null && licenseFileString.match(/\s*Apache License/)) {
        license = tryGetLicenseFromReadme(dir);
    } else {
        license = licenseFileString;
    }
    return license || licenseFileString;
}

function getFilePathStartsWith(dir, name) {
    var files = fs.readdirSync(dir);
    for (var i = 0; i < files.length; i++) {
        var regex = new RegExp(name + '(?:\.\S*)?', 'i');
        if (files[i].match(regex)) {
            return path.join(dir, files[i]);
        }
    }
    return null;
}

function tryGetLicenseFromReadme(dir) {
    var files = fs.readdirSync(dir);
    var readmePath = getFilePathStartsWith(dir, 'readme');
    var readme = fs.readFileSync(readmePath, "utf8");
    var matches = readme.match(/(?:License\n-+|#+\s+License)\n*(?:`{3}|(?=\n?\ {4})|(?=.*License))+\n*((?:.|\n(?!\ \[|\`{3}|#+\s+\w+))*)/i);
    return matches != null ? matches[1] : null;
}

function readLicenseFile(path) {
    var licensePath = getFilePathStartsWith(path, 'license');
    return licensePath == null ? null : fs.readFileSync(licensePath, "utf8");
}

function getHtmlForLicenseString(licenseString) {
    var licenseHtml = licenseString.replace(/(?:\S+.*\n?\ *)+/g, '<p>$&</p>');
    var template = readTemplateFile('license.html');
    return template.replace('<!--LICENSE-->', licenseHtml);
}

module.exports = licensesHtmlGenerator;
