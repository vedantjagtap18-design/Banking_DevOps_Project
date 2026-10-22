# Secure CI/CD & Observability Pipeline for Banking Application

An enterprise-grade DevOps demonstration of a **Banking Transaction Application** featuring:
- **Source Control**: GitHub repository with branch protection concepts
- **Continuous Integration (CI)**: Automated builds and headless **Selenium** functional tests
- **Quality Gate**: Automatic failure handling preventing packaging of defective code
- **Containerization**: Hardened, multi-stage **Docker** container
- **Orchestration**: Zero-downtime rolling deployments on **Kubernetes**
- **Observability**: **Prometheus** metrics collection (`/metrics`) and custom **Grafana** reliability dashboards with alerts

---

## Architecture Flow

```
[Developer]
    │  git push
    ▼
[GitHub Repository]
    │  Webhook / Poll SCM
    ▼
[Jenkins Pipeline]
    ├─ Stage 1: Checkout Code
    ├─ Stage 2: Install Dependencies (`npm ci`)
    ├─ Stage 3: Selenium Functional Tests (Quality Gate)
    │           ├── ❌ FAIL: ABORT PIPELINE (Zero Deployment)
    │           └── ✔️ PASS: Continue
    ├─ Stage 4: Docker Container Packaging (`banking-app:${BUILD_NUMBER}`)
    ├─ Stage 5: Push to Registry (Optional)
    ├─ Stage 6: Kubernetes Deployment (`kubectl apply -f k8s/`)
    └─ Stage 7: Health & Metrics Verification
    │
    ▼
[Kubernetes Cluster (Pods & Service :30080)]
    ▲
    │ Scrapes /metrics every 5s
[Prometheus Server (:30090)]
    │ Datasource Query
    ▼
[Grafana Dashboard (:30300)] ──► Fires Alerts on 5xx Error Rate > 5%
```

---

## Directory Structure

```
DevOps_mini_project/
├── Dockerfile                      # Production Node.js Alpine container
├── Jenkinsfile                     # Declarative CI/CD pipeline definition
├── package.json                    # Dependencies (Express, prom-client, Selenium)
├── src/
│   ├── server.js                   # Core Express banking backend & API
│   ├── metrics.js                  # Prometheus custom instrumentation
│   └── public/
│       ├── index.html              # Modern banking portal UI
│       ├── css/style.css           # Premium financial theme
│       └── js/app.js               # Frontend business logic & failure injection
├── tests/
│   └── selenium-test.js            # Automated Selenium E2E test suite
├── k8s/
│   ├── banking-app-deployment.yaml # K8s deployment (2 replicas, rolling updates)
│   └── banking-app-service.yaml    # NodePort service on port 30080
└── monitoring/
    ├── prometheus-configmap.yaml   # Prometheus config & alert rules
    ├── prometheus-deployment.yaml  # Prometheus server on port 30090
    ├── grafana-deployment.yaml     # Grafana server on port 30300
    └── grafana-banking-dashboard.json # Pre-built Grafana JSON dashboard
```

---

## Quick Start (Local Run)

### 1. Install Dependencies
```bash
npm install
```

### 2. Run the Banking App Locally
```bash
npm start
```
- Open browser at `http://localhost:3000`
- Check Prometheus metrics at `http://localhost:3000/metrics`
- Test Credentials:
  - Username: `john_doe`
  - Password: `Password@123`

### 3. Run Selenium Automated Tests
```bash
npm test
```
The test suite will:
1. Spin up a test server instance
2. Launch Headless Chrome
3. Validate invalid login rejection
4. Validate authenticated login & balance display ($5,400.00)
5. Execute fund transfer ($150.00) and verify updated balance ($5,250.00)
6. Verify overdraft / insufficient funds protection

---

## Demonstrations Required by the Project

### Demonstration 1: Failed Tests Prevent Deployment (Quality Gate)
To show how a defective commit is blocked before Docker build or Kubernetes rollout:

1. Run the failing test mode:
   ```bash
   npm run test:fail
   ```
2. **Result**: The test will throw an intentional assertion failure, exit with status code `1`, and abort the pipeline execution at Stage 3.
3. In Jenkins, the pipeline turns **RED (FAILURE)**. Stages 4, 5, and 6 (Docker Build and K8s Deploy) are **skipped**, ensuring production is protected from regressions.

### Demonstration 2: Production Incident Detection via Prometheus & Grafana
To simulate a real-world outage and observe Grafana alert triggers:

1. Open the Banking Portal dashboard at `http://localhost:3000` (or `http://<NodeIP>:30080` in Kubernetes).
2. Click the **"Toggle Failure Injection (Demo)"** button.
3. Perform any transaction or refresh the page. The backend will return simulated `500 Internal Server Errors`.
4. Open **Prometheus** (`http://<NodeIP>:30090/alerts`) to see the `HighHttp5xxErrorRate` rule switch from **Inactive** $\rightarrow$ **Pending** $\rightarrow$ **Firing**.
5. Open **Grafana** (`http://<NodeIP>:30300`) and view the **HTTP Traffic & 5xx Production Error Rate** graph spiking in real time!
