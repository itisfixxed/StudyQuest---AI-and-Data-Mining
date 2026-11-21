import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: "./",
  plugins: [tailwindcss()],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: { groups: [
          { name: 'past-papers', test: /[\\/]src[\\/]content[\\/](?:exam-questions|papers)\.json/ },
          { name: 'course-content', test: /[\\/]src[\\/]content[\\/]/ },
          { name: 'math-rendering', test: /[\\/]node_modules[\\/]katex[\\/]/ }
        ] }
      }
    }
  }
});
