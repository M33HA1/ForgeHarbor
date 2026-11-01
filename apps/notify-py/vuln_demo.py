import subprocess
import os

def run_user_command(user_input):
    # Vulnerable: shell=True with user input
    result = subprocess.run(user_input, shell=True)
    return result
