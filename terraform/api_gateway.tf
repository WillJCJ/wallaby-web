resource "aws_apigatewayv2_api" "wallaby_api" {
  name          = "wallaby_api"
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_integration" "lambda_integration" {
  api_id                 = aws_apigatewayv2_api.wallaby_api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.wallaby_lambda.invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "home_route" {
  api_id    = aws_apigatewayv2_api.wallaby_api.id
  route_key = "GET /"
  target    = "integrations/${aws_apigatewayv2_integration.lambda_integration.id}"
}

resource "aws_apigatewayv2_route" "about_route" {
  api_id    = aws_apigatewayv2_api.wallaby_api.id
  route_key = "GET /about"
  target    = "integrations/${aws_apigatewayv2_integration.lambda_integration.id}"
}

resource "aws_lambda_permission" "apigw" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.wallaby_lambda.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.wallaby_api.execution_arn}/*/*"
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.wallaby_api.id
  name        = "$default"
  auto_deploy = true
}
