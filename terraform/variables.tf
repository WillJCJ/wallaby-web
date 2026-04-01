locals {
  s3_origin_id = "S3-wallaby-web-static"
  my_domain    = "wallabyfest.co.uk"

  lambda_src_dir    = "../awslambda"
  lambda_deploy_dir = "deploy"

  static_directory = "../static"
}
