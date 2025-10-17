# Run as Admin once
winget install -e --id Docker.DockerDesktop
winget install -e --id Amazon.AWSCLI
pip install -r apps/api/requirements.txt
docker --version
aws --version
