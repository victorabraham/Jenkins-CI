node {
    stage 'checkout'
    git 'https://github.com/victorabraham/Jenkins-CI.git'
    
    nodejs('V 6.13') {
        stage 'package'
        sh 'npm install'
        sh 'npm run package'

        stage 'deploy'
        sh 'npm run deploy'

        stage 'test'
        sh 'echo RUNTESTS'
    }

    stage 'archive'
    archiveArtifacts artifacts: 'src/package.xml', followSymlinks: false
}