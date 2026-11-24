# StudyQuest

Mobile-friendly revision for Artificial Intelligence and Data Mining. Includes 39 lessons, 208 generated practice questions, formula recall, and mock and topic exams.

This GitHub Pages edition contains generated study content. The full local edition contains the past-paper scans, exam solutions and adapted exercises. Study progress lives in the current browser, so keep using the same URL and browser for a consistent profile.

## Publish to GitHub Pages

1. Create an empty GitHub repository, for example `studyquest`. Use the contents of this folder as the repository root so `.github/workflows/pages.yml` sits directly under the root.
2. In **Settings → Pages → Build and deployment**, select **GitHub Actions** as the source.
3. Push the contents to the `main` branch. If the first run started before enabling Pages, open **Actions → Deploy StudyQuest to GitHub Pages → Run workflow** after enabling it.
4. Open the URL shown by the deployment job on your phone. A typical project URL is `https://YOUR-USERNAME.github.io/studyquest/`. Use your browser’s **Add to Home Screen** command if you want a shortcut.

[GitHub Pages setup](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

## Push from PowerShell

Start in this folder, and replace the username and repository name in the URL.

```powershell
git init -b main
git add .
git commit -m "Publish StudyQuest"
git remote add origin https://github.com/YOUR-USERNAME/studyquest.git
git push -u origin main
```

## Develop locally

```powershell
npm ci
npm test
npm run dev
```

## Add the private study pack on your phone

1. Save the supplied **StudyQuest-Study-Pack.zip** to Files or Downloads on your phone. Keep it outside the GitHub repository.
2. Open the deployed StudyQuest site. Go to **Settings → Private study pack → Choose study pack** and select the ZIP without extracting it. If you already have the study-pack JSON, import it and select **Download study pack ZIP** in Settings to save a ZIP copy.
3. After the page reloads, open **Exam Arena** to choose a past paper. **Practice** also includes the adapted exercises and original questions.

StudyQuest verifies this edition’s study pack and stores it using browser storage. The file is read on the device and is never sent to GitHub. If you switch browsers or clear site data, import it again. If some saved records need their original pack, reimport it in Settings to restore them. Import the supplied study pack ZIP. The project ZIP contains the website source.

## Publish from VS Code

Open **this folder** in VS Code. In **Source Control**, choose **Publish to GitHub** and sign in if prompted. Choose **Publish to GitHub public repository** for personal GitHub Pages, confirm the file list, and publish to `main`. Under the new repository’s **Settings → Pages**, choose **GitHub Actions**. Open **Actions → Deploy StudyQuest to GitHub Pages → Run workflow** and select `main` if the initial workflow started before Pages was enabled. The successful deployment shows the phone-ready URL.

[VS Code GitHub publishing guide](https://code.visualstudio.com/docs/sourcecontrol/github)

## Guided lectures

Go to **Learning Journey**, choose a topic, and select **Start lecture**. Each lecture uses a three-section worked example with diagrams or charts, a hint and check per section, and a final explain-it-back exercise. Follow the linked concept lessons for more detail. Lecture checkmarks and draft explanations last for the open lecture session.

## Study pack v2

Import the private `StudyQuest-Study-Pack-v2.zip` under **Settings → Private study pack**. If you have imported both versions, use **Study pack version** to switch between them. The same progress and question IDs apply to both versions. Version 2 includes the revised tutorials, guided lectures, and original papers.

In **Exam Arena**, choose a paper or open a sourced question. **View paper PDF** opens the cited page in the app. Use **Open original PDF** for the full PDF in a browser tab. The app reads these files from the imported pack on this device.

In authored study text, write inline math as `\( ... \)` and display math as `\[ ... \]`. Unicode symbols also work in plain text. JSON strings require doubled backslashes, for example `"The probability is \\( P(A \\mid B) \\)."`.

Approved module ZIPs can be imported as supplied or repacked with the same JSON content using regular ZIP compression. Import module packs under **Settings → Modules**.
