import {defineConfig} from 'vite'

export default defineConfig({
  build:{
    rollupOptions:{
      input:{main:'index.html',study:'src/study.ts'},
      output:{
        entryFileNames:chunk=>chunk.name==='study'?'assets/study.js':'assets/[name]-[hash].js',
        assetFileNames:asset=>asset.names.includes('study.css')?'assets/study.css':'assets/[name]-[hash][extname]',
      },
    },
  },
})
