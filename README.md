# StudyQuest IE4483

Mobile-friendly revision for Artificial Intelligence and Data Mining. Includes 39 lessons, 208 generated practice questions, formula recall, and mock and topic exams.

This GitHub Pages edition contains generated study content. The full local edition contains the NTU past-paper scans, exam solutions and adapted exercises. Study progress lives in the current browser, so keep using the same URL and browser for a consistent profile.

## Publish to GitHub Pages

1. Create an empty GitHub repository, for example `studyquest-ie4483`. Use the contents of this folder as the repository root so `.github/workflows/pages.yml` sits directly under the root.
2. In **Settings → Pages → Build and deployment**, select **GitHub Actions** as the source.
3. Push the contents to the `main` branch. If the first run started before enabling Pages, open **Actions → Deploy StudyQuest to GitHub Pages → Run workflow** after enabling it.
4. Open the URL shown by the deployment job on your phone. A typical project URL is `https://YOUR-USERNAME.github.io/studyquest-ie4483/`. Use your browser’s **Add to Home Screen** command if you want a shortcut.

[GitHub Pages setup](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

## Push from PowerShell

Start in this folder, and replace the username and repository name in the URL.

```powershell
git init -b main
git add .
git commit -m "Publish StudyQuest IE4483"
git remote add origin https://github.com/YOUR-USERNAME/studyquest-ie4483.git
git push -u origin main
```

## Develop locally

```powershell
npm ci
npm test
npm run dev
```

## Add the private IE4483 study pack on your phone

1. Save the supplied **StudyQuest-IE4483-Study-Pack.zip** to Files or Downloads on your phone. Keep it outside the GitHub repository.
2. Open the deployed StudyQuest site. Go to **Settings → Private study pack → Choose IE4483 study pack** and select the ZIP without extracting it. The original study-pack JSON also works.
3. After the page reloads, open **Exam Arena** to choose a past paper. **Practice** also includes the adapted exercises and original questions.

StudyQuest verifies this edition’s study pack and stores it using browser storage. The file is read on the device and is never sent to GitHub. If you switch browsers or clear site data, import it again. Import the study pack before restoring a progress backup containing past-paper attempts. Import the supplied study pack ZIP. The project ZIP contains the website source.

## Publish from VS Code

Open **this folder** in VS Code. In **Source Control**, choose **Publish to GitHub** and sign in if prompted. Choose **Publish to GitHub public repository** for personal GitHub Pages, confirm the file list, and publish to `main`. Under the new repository’s **Settings → Pages**, choose **GitHub Actions**. Open **Actions → Deploy StudyQuest to GitHub Pages → Run workflow** and select `main` if the initial workflow started before Pages was enabled. The successful deployment shows the phone-ready URL.

[VS Code GitHub publishing guide](https://code.visualstudio.com/docs/sourcecontrol/github)

