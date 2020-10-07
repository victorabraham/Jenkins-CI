node {
    stage 'checkout'
    git 'https://github.com/victorabraham/Jenkins-CI.git'
    
    nodejs('V 10.10') {
        stage 'package'
        sh 'npm install'
        sh 'npm run package'

        stage 'deploy'
        npm run deploy

        stage 'test'
        sh 'echo RUNTESTS'
    }

    stage 'archive'
    archiveArtifacts artifacts: 'src/package.xml', followSymlinks: false
}