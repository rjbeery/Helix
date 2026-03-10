Operational commands

View lambda logs

aws logs filter-log-events --log-group-name "/aws/lambda/helixai-api"

Update terraform

cd infra/terraform
terraform apply

Update model ID

edit infra/terraform/main.tf
update MODEL_* value
terraform apply -target=aws_lambda_function.api

Restart lambda

aws lambda update-function-configuration --function-name helixai-api --description "restart"
