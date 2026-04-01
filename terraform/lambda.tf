data "archive_file" "wallaby_lambda_payload" {
  type       = "zip"
  source_dir = local.lambda_src_dir
  excludes = [
    "requirements",
    ".DS_Store",
  ]
  output_path = "${local.lambda_deploy_dir}/zips/payload.zip"
}

resource "aws_lambda_function" "wallaby_lambda" {
  function_name    = "wallaby_lambda"
  handler          = "app.lambda_handler"
  runtime          = "python3.13"
  role             = aws_iam_role.lambda_exec.arn
  filename         = data.archive_file.wallaby_lambda_payload.output_path
  source_code_hash = data.archive_file.wallaby_lambda_payload.output_base64sha256
  layers           = [aws_lambda_layer_version.requirements_layer.arn]

  timeout = 10

  environment {
    variables = {
      STATIC_ROOT = "https://static.wallabyfest.co.uk"
    }
  }
}

resource "aws_iam_role" "lambda_exec" {
  name = "lambda_exec_role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Action = "sts:AssumeRole",
      Effect = "Allow",
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_policy" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Lambda Layer: Install requirements and zip them up
resource "null_resource" "install_requirements" {
  provisioner "local-exec" {
    command = <<EOT
      mkdir -p ${local.lambda_deploy_dir}/code/python
      pip install -r ${local.lambda_src_dir}/requirements/prod.txt -t ${local.lambda_deploy_dir}/code/python/
    EOT
  }

  triggers = {
    requirements_hashes = join("-", [
      filesha256("${local.lambda_src_dir}/requirements/base.txt"),
      filesha256("${local.lambda_src_dir}/requirements/prod.txt"),
    ])
  }
}

data "archive_file" "requirements_layer_zip" {
  type        = "zip"
  source_dir  = "${local.lambda_deploy_dir}/code/"
  output_path = "${local.lambda_deploy_dir}/zips/requirements_layer.zip"

  depends_on = [null_resource.install_requirements]
}

resource "aws_lambda_layer_version" "requirements_layer" {
  layer_name          = "wallaby_requirements"
  filename            = data.archive_file.requirements_layer_zip.output_path
  compatible_runtimes = ["python3.13"]
  source_code_hash    = data.archive_file.requirements_layer_zip.output_base64sha256
}
