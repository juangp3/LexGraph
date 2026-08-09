FROM postgres:17

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    git \
    postgresql-server-dev-17 \
    flex \
    bison \
    libreadline-dev \
    zlib1g-dev \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Build Apache AGE from source (no official arm64 image exists for the
# pre-built apache/age Docker image, but the extension itself is a normal
# PGXS build and compiles fine on arm64).
# Check https://github.com/apache/age/branches for the tag/branch matching
# PostgreSQL 17 before running this — the branch name below may need updating.
RUN git clone --depth 1 --branch PG17 https://github.com/apache/age.git /tmp/age \
  && cd /tmp/age \
  && make PG_CONFIG=/usr/lib/postgresql/17/bin/pg_config \
  && make PG_CONFIG=/usr/lib/postgresql/17/bin/pg_config install \
  && rm -rf /tmp/age
