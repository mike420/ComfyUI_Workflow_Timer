# Import Classes
from .py.workflow_timer import MTWorkflowTimerNode
        
# Register the nodes
NODE_CLASS_MAPPINGS = {
    "MTWorkflowTimerNode": MTWorkflowTimerNode
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "MTWorkflowTimerNode": "🕒 Workflow Timer"
}

# Web directory for JavaScript files
WEB_DIRECTORY = "./js"
__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
