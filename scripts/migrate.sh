#!/bin/bash
prisma migrate resolve --rolled-back 20260513000000_add_api_keys || true
prisma migrate resolve --applied 20260404161837_add_extracto_source || true
prisma migrate resolve --applied 20260416000000_add_users || true
prisma migrate deploy
