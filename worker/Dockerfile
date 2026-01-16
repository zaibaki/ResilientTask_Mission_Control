FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Unbuffered output is important for docker logs
ENV PYTHONUNBUFFERED=1

CMD ["python", "worker.py"]
