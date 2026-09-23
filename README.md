# apkm → apk

minimal, client-side `.apkm` to `.apk` web utility.
https://demaxi1337.github.io/apkm-to-apk-converter/

## what it does

The page opens an `.apkm` archive directly in the browser, finds `base.apk`, validates that it is a zip-based APK, and lets you save it as an `.apk` file.

When split APKs are present, the page also offers a `.zip` containing the APK files from the package.

This is intentionally not advertised as a split-APK merger: APKMirror packages can contain a base APK plus configuration/feature splits, and those pieces are normally installed together by an Android bundle installer.

## run

No build step is required.

Open `index.html` directly, or serve the folder with any static web server:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

`jszip` is loaded from jsdelivr. For a fully offline build, replace the CDN script with a local copy of `jszip.min.js`.

## notes

- input limit: 1 gb
- processing happens locally in the browser
- no file is uploaded by this project
- a base APK extracted from a split package may not work as a standalone APK because required splits can be missing
