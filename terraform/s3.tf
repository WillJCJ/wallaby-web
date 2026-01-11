resource "aws_s3_bucket" "wallaby_web_static" {
  bucket = "wallaby-web-static"
}


# See https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html
data "aws_iam_policy_document" "origin_bucket_policy" {
  statement {
    sid    = "AllowCloudFrontServicePrincipalReadWrite"
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    actions = [
      "s3:GetObject",
      "s3:PutObject",
    ]

    resources = [
      "${aws_s3_bucket.wallaby_web_static.arn}/*",
    ]

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.wallaby_web.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "wallaby_web_static_policy" {
  bucket = aws_s3_bucket.wallaby_web_static.bucket
  policy = data.aws_iam_policy_document.origin_bucket_policy.json
}
locals {
  css_files = {
    for file in fileset(local.static_directory, "css/*") :
    file => file
    if !startswith(file, ".")
  }
  favicon_files = {
    for file in fileset(local.static_directory, "favicon/*") :
    file => file
    if !startswith(file, ".")
  }
  upload_files = {
    for file in fileset(local.static_directory, "upload/*") :
    file => file
    if !startswith(file, ".")
  }
}

resource "aws_s3_object" "css" {
  for_each = local.css_files

  bucket = aws_s3_bucket.wallaby_web_static.id
  key    = each.key
  source = "${local.static_directory}/${each.value}"
  etag   = filemd5("${local.static_directory}/${each.value}")

  content_type = "text/css"
}

resource "aws_s3_object" "favicons" {
  for_each = local.favicon_files

  bucket = aws_s3_bucket.wallaby_web_static.id
  key    = each.key
  source = "${local.static_directory}/${each.value}"
  etag   = filemd5("${local.static_directory}/${each.value}")
}

resource "aws_s3_object" "uploads" {
  for_each = local.upload_files

  bucket = aws_s3_bucket.wallaby_web_static.id
  key    = each.key
  source = "${local.static_directory}/${each.value}"
  etag   = filemd5("${local.static_directory}/${each.value}")
}
