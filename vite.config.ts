import {defineConfig} from 'vite'

export default defineConfig({
  build:{
    rollupOptions:{
      input:{main:'index.html',study:'src/study.ts',puzzle:'src/public-puzzle.ts'},
      output:{
        entryFileNames:chunk=>['study','puzzle'].includes(chunk.name)?'assets/'+chunk.name+'.js':'assets/[name]-[hash].js',
        assetFileNames:asset=>asset.names.includes('study.css')?'assets/study.css':'assets/[name]-[hash][extname]',
      },
    },
  },
})
