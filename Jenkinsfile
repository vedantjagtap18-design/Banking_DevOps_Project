pipeline {
    agent any

    environment {
        APP_NAME = 'banking-app'
        DOCKER_REGISTRY = 'docker.io/mybank' // Replace with your Docker Hub username
        IMAGE_TAG = "${env.BUILD_NUMBER}"
        KUBECONFIG_CREDENTIAL_ID = 'k8s-kubeconfig'
    }

    stages {
        stage('1. Checkout Source Code') {
            steps {
                echo '=== [CI] Fetching latest commit from GitHub repository ==='
                checkout scm
            }
        }

        stage('2. Install Dependencies & Lint') {
            steps {
                echo '=== [CI] Installing production & test dependencies ==='
                // Use bat on Windows agents or sh on Linux agents
                script {
                    if (isUnix()) {
                        sh 'npm ci'
                    } else {
                        bat 'npm ci'
                    }
                }
            }
        }

        stage('3. Selenium Functional Tests (Quality Gate)') {
            steps {
                echo '=== [CI GATE] Running Automated Selenium Functional Tests ==='
                echo 'Testing: Login, Account Balance, Fund Transfers & Overdraft Limits'
                script {
                    try {
                        if (isUnix()) {
                            sh 'npm test'
                        } else {
                            bat 'npm test'
                        }
                        echo '=== [CI GATE PASSED] All functional tests succeeded! Proceeding to packaging ==='
                    } catch (Exception err) {
                        currentBuild.result = 'FAILURE'
                        error("=== [CI GATE FAILED] Selenium test assertion failed! Pipeline aborted. Deployment prevented! ===")
                    }
                }
            }
        }

        stage('4. Docker Build Container Image') {
            steps {
                echo "=== [CD] Building Docker Container: ${APP_NAME}:${IMAGE_TAG} ==="
                script {
                    if (isUnix()) {
                        sh "docker build -t ${APP_NAME}:${IMAGE_TAG} -t ${APP_NAME}:latest ."
                    } else {
                        bat "docker build -t ${APP_NAME}:${IMAGE_TAG} -t ${APP_NAME}:latest ."
                    }
                }
            }
        }

        stage('5. Docker Push to Registry') {
            // Optional: configure Docker credentials in Jenkins if pushing to remote Docker Hub
            when {
                environment name: 'PUSH_IMAGE', value: 'true'
            }
            steps {
                echo "=== [CD] Pushing image to registry ==="
                script {
                    if (isUnix()) {
                        sh "docker push ${APP_NAME}:${IMAGE_TAG}"
                    } else {
                        bat "docker push ${APP_NAME}:${IMAGE_TAG}"
                    }
                }
            }
        }

        stage('6. Deploy to Kubernetes Cluster') {
            steps {
                echo '=== [CD] Applying Kubernetes Manifests (Rolling Zero-Downtime Update) ==='
                script {
                    if (isUnix()) {
                        sh 'kubectl apply -f k8s/banking-app-deployment.yaml'
                        sh 'kubectl apply -f k8s/banking-app-service.yaml'
                        sh 'kubectl rollout status deployment/banking-app-deployment --timeout=90s'
                    } else {
                        bat 'kubectl apply -f k8s/banking-app-deployment.yaml'
                        bat 'kubectl apply -f k8s/banking-app-service.yaml'
                        bat 'kubectl rollout status deployment/banking-app-deployment --timeout=90s'
                    }
                }
            }
        }

        stage('7. Observability & Health Verification') {
            steps {
                echo '=== [CD] Verifying Deployment Health & Prometheus Endpoint ==='
                script {
                    if (isUnix()) {
                        sh 'kubectl get pods -l app=banking-app'
                        sh 'kubectl get svc banking-app-service'
                    } else {
                        bat 'kubectl get pods -l app=banking-app'
                        bat 'kubectl get svc banking-app-service'
                    }
                }
            }
        }
    }

    post {
        always {
            echo "Pipeline run completed with status: ${currentBuild.currentResult}"
            cleanWs deleteDirs: true, notFailBuild: true
        }
        success {
            echo '============================================================='
            echo ' SUCCESS: Banking App deployed to Kubernetes successfully! '
            echo ' Observability active at: http://<NodeIP>:30090 (Prometheus)'
            echo ' Grafana Dashboard active at: http://<NodeIP>:30300'
            echo '============================================================='
        }
        failure {
            echo '============================================================='
            echo ' FAILED: Pipeline stopped by automated Quality Gate! '
            echo ' Unverified code was NOT packaged or deployed to production. '
            echo '============================================================='
        }
    }
}
