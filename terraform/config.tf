terraform {
  backend "s3" {
    bucket  = "terraform-states-will"
    key     = "wallaby-web/terraform.tfstate"
    region  = "eu-west-2"
    encrypt = true
  }
}

provider "aws" {
  region = "eu-west-2"
}
