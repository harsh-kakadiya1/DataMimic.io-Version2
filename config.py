import os

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'your_default_flask_secret_key_here_for_dev_only'
    
    # Paths for generated data only (no upload folder needed since we process files in memory)
    GENERATED_DATA_FOLDER = os.path.join(os.path.abspath(os.path.dirname(__file__)), 'generated_data')
    
    # INCREASE THIS VALUE SIGNIFICANTLY (e.g., to 100 MB)
    MAX_CONTENT_LENGTH = 100 * 1024 * 1024 # 100 Megabytes limit for uploads

    # Allowed file extensions for uploads
    ALLOWED_EXTENSIONS = {'csv', 'xlsx'}

    # Flask-Mail configuration (for your contact form)
    MAIL_SERVER = 'smtp.gmail.com' # Or your specific SMTP server
    MAIL_PORT = 587
    MAIL_USE_TLS = True
    MAIL_USERNAME = os.environ.get('EMAIL_USER') # Loaded from .env or environment variable
    MAIL_PASSWORD = os.environ.get('EMAIL_PASS') # Loaded from .env or environment variable
    MAIL_DEFAULT_SENDER = ('DataMimic.io Support', os.environ.get('EMAIL_USER')) # Display name and sender email

    # Ensure generated data directory exists on startup (no upload folder needed)
    os.makedirs(GENERATED_DATA_FOLDER, exist_ok=True)

    @staticmethod
    def allowed_file(filename):
        return '.' in filename and \
               filename.rsplit('.', 1)[1].lower() in Config.ALLOWED_EXTENSIONS