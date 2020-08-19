FROM python:3

# Set application working directory
WORKDIR /usr/src/app

# Install requirements
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Install application
COPY app.py ./

EXPOSE 8080 
# Run application
CMD python app.py

