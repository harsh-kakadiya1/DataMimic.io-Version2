import os

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'your_default_flask_secret_key_here_for_dev_only'
    
    # Paths for uploads and generated data
    UPLOAD_FOLDER = os.path.join(os.path.abspath(os.path.dirname(__file__)), 'uploads')
    GENERATED_DATA_FOLDER = os.path.join(os.path.abspath(os.path.dirname(__file__)), 'generated_data')
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024 # 16 Megabytes limit for uploads

    # Allowed file extensions for uploads
    ALLOWED_EXTENSIONS = {'csv', 'xlsx'}

    # Flask-Mail configuration (for your contact form)
    MAIL_SERVER = 'smtp.gmail.com' # Or your specific SMTP server
    MAIL_PORT = 587
    MAIL_USE_TLS = True
    MAIL_USERNAME = os.environ.get('EMAIL_USER') # Loaded from .env or environment variable
    MAIL_PASSWORD = os.environ.get('EMAIL_PASS') # Loaded from .env or environment variable
    MAIL_DEFAULT_SENDER = ('DataMimic.io Support', MAIL_USERNAME) # Display name and sender email

    # Ensure upload and generated data directories exist on startup
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    os.makedirs(GENERATED_DATA_FOLDER, exist_ok=True)

    @staticmethod
    def allowed_file(filename):
        return '.' in filename and \
               filename.rsplit('.', 1)[1].lower() in Config.ALLOWED_EXTENSIONS