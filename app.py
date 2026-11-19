import os
import subprocess
import time
import urllib.request
import gradio as gr
import spaces

subprocess.run(["npm", "install"], check=True)
subprocess.run(["npm", "run", "build"], check=True)
subprocess.Popen(["npm", "start"])
time.sleep(2)

def check_bot():
    try:
        return urllib.request.urlopen("http://127.0.0.1:3000/health", timeout=3).read().decode()
    except Exception as e:
        return f"Starting / Error: {e}"

@spaces.GPU
def gpu_keepalive():
    return "ZeroGPU Hook Active"

with gr.Blocks() as demo:
    gr.Markdown("## Aloo Bot — Dual PostgreSQL Runtime")
    status_box = gr.Textbox(value=check_bot, label="Runtime Health")
    gr.Button("Refresh Status").click(fn=check_bot, outputs=status_box)
    hidden_btn = gr.Button("GPU", visible=False)
    hidden_btn.click(fn=gpu_keepalive, outputs=status_box)

demo.launch(server_name="0.0.0.0", server_port=7860)
