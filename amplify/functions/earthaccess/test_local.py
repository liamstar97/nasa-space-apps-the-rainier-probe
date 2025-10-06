#!/usr/bin/env python3
"""
Local test script for the earthaccess Lambda function.

Before running this script, make sure to set your NASA Earthdata credentials:
    export EARTHDATA_USERNAME='your_username'
    export EARTHDATA_PASSWORD='your_password'

Optional: For enhanced memory tracking, install psutil:
    pip install psutil

Usage:
    python test_local.py
"""

import json
import os
import time
import tracemalloc
from index import handler

# Try to import psutil for more detailed memory tracking
try:
    import psutil
    PSUTIL_AVAILABLE = True
except ImportError:
    PSUTIL_AVAILABLE = False
    print("Note: psutil not installed. Install with 'pip install psutil' for more detailed memory tracking.")


def format_bytes(bytes_value):
    """Format bytes into human-readable format."""
    for unit in ['B', 'KB', 'MB', 'GB']:
        if bytes_value < 1024.0:
            return f"{bytes_value:.2f} {unit}"
        bytes_value /= 1024.0
    return f"{bytes_value:.2f} TB"


class MockContext:
    """Mock Lambda context object for local testing."""
    def __init__(self):
        self.function_name = "earthaccess-local-test"
        self.function_version = "$LATEST"
        self.invoked_function_arn = "arn:aws:lambda:us-east-1:123456789012:function:earthaccess-local-test"
        self.memory_limit_in_mb = 128
        self.aws_request_id = "test-request-id"
        self.log_group_name = "/aws/lambda/earthaccess-local-test"
        self.log_stream_name = "2025/10/06/[$LATEST]test"
    
    def get_remaining_time_in_millis(self):
        return 300000  # 5 minutes


def test_handler():
    """Test the Lambda handler function locally."""
    # Check for required environment variables
    if not os.getenv('EARTHDATA_USERNAME') or not os.getenv('EARTHDATA_PASSWORD'):
        print("⚠️  WARNING: EARTHDATA_USERNAME and EARTHDATA_PASSWORD environment variables not set!")
        print("Set them with:")
        print("  export EARTHDATA_USERNAME='your_username'")
        print("  export EARTHDATA_PASSWORD='your_password'")
        print()
        response = input("Continue anyway? (y/n): ")
        if response.lower() != 'y':
            return
    
    # Create a mock event (you can customize this as needed)
    event = {
        "requestContext": {
            "requestId": "test-request-id"
        }
    }
    
    # Create mock context
    context = MockContext()
    
    print("=" * 60)
    print("Starting Lambda function test...")
    print("=" * 60)
    print()
    
    try:
        # Start memory tracking
        tracemalloc.start()
        
        # Get process if psutil is available
        if PSUTIL_AVAILABLE:
            process = psutil.Process()
            mem_before = process.memory_info().rss
        
        # Call the handler and time it
        start_time = time.perf_counter()
        response = handler(event, context)
        end_time = time.perf_counter()
        elapsed_time = end_time - start_time
        
        # Get memory usage
        current_mem, peak_mem = tracemalloc.get_traced_memory()
        tracemalloc.stop()
        
        if PSUTIL_AVAILABLE:
            mem_after = process.memory_info().rss
            mem_used = mem_after - mem_before
        
        print()
        print("=" * 60)
        print("Lambda function completed successfully!")
        print("=" * 60)
        print()
        
        # Format and display execution time
        if elapsed_time < 1:
            time_str = f"{elapsed_time * 1000:.2f} milliseconds"
        elif elapsed_time < 60:
            time_str = f"{elapsed_time:.2f} seconds"
        elif elapsed_time < 3600:
            minutes = int(elapsed_time // 60)
            seconds = elapsed_time % 60
            time_str = f"{minutes} minute(s) {seconds:.2f} seconds"
        else:
            hours = int(elapsed_time // 3600)
            minutes = int((elapsed_time % 3600) // 60)
            seconds = elapsed_time % 60
            time_str = f"{hours} hour(s) {minutes} minute(s) {seconds:.2f} seconds"
        
        print(f"⏱️  Execution Time: {time_str}")
        print()
        
        # Display memory usage
        print("💾 Memory Usage:")
        print(f"   Python Peak Memory: {format_bytes(peak_mem)}")
        print(f"   Python Current Memory: {format_bytes(current_mem)}")
        
        if PSUTIL_AVAILABLE:
            print(f"   Process Memory Used: {format_bytes(mem_used)}")
            print(f"   Total Process Memory: {format_bytes(mem_after)}")
        
        print()
        print("Response:")
        print(json.dumps(response, indent=2))
        print()
        
        # Parse and display the body if it exists
        if "body" in response:
            body = json.loads(response["body"])
            print("Response Body:")
            print(json.dumps(body, indent=2))
        
    except Exception as e:
        print()
        print("=" * 60)
        print("❌ ERROR: Lambda function failed!")
        print("=" * 60)
        print()
        print(f"Error type: {type(e).__name__}")
        print(f"Error message: {str(e)}")
        import traceback
        print()
        print("Full traceback:")
        traceback.print_exc()


if __name__ == "__main__":
    test_handler()

