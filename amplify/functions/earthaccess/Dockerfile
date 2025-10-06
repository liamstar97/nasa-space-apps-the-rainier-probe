# Start with the final AWS Lambda base image
FROM public.ecr.aws/lambda/python:3.12

# Install ALL dependencies at once: build tools (-devel) and runtime libs
RUN dnf update -y && dnf install -y \
    gcc \
    gcc-c++ \
    python3.11-devel

WORKDIR ${LAMBDA_TASK_ROOT}

COPY requirements.txt .

# Install packages directly into the standard site-packages.
# This might take a while as it will compile from source.
RUN pip install --no-cache-dir -r requirements.txt

COPY index.py .

CMD ["index.handler"]