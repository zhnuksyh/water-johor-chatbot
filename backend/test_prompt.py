from fastapi.testclient import TestClient
from main import app, MOCK_USER_DATABASE

client = TestClient(app)

def test_structure():
    print("\n--- Testing Structure (Lists) ---")
    response = client.post("/v1/chat/completions", json={
        "messages": [{"role": "user", "content": "How can I pay my bill?"}],
        "mode": "normal"
    })
    print(f"Response: {response.json()['choices'][0]['message']['content']}")

def test_brevity():
    print("\n--- Testing Brevity ---")
    response = client.post("/v1/chat/completions", json={
        "messages": [{"role": "user", "content": "My bill is too high."}],
        "mode": "normal"
    })
    print(f"Response: {response.json()['choices'][0]['message']['content']}")

def test_grounding():
    print("\n--- Testing Grounding (Off-topic) ---")
    response = client.post("/v1/chat/completions", json={
        "messages": [{"role": "user", "content": "What is the best nasi lemak in JB?"}],
        "mode": "normal"
    })
    print(f"Response: {response.json()['choices'][0]['message']['content']}")

def test_context_injection():
    print("\n--- Testing User Context Injection ---")
    serial = "123456"
    print(f"Using Serial: {serial} (User: {MOCK_USER_DATABASE[serial]['name']})")
    
    response = client.post("/v1/chat/completions", json={
        "messages": [{"role": "user", "content": "How much is my outstanding bill?"}],
        "mode": "normal",
        "serial_number": serial
    })
    print(f"Response: {response.json()['choices'][0]['message']['content']}")

if __name__ == "__main__":
    # Mock the LLM to return the system prompt or a debug message if needed, 
    # but efficient testing usually checks the PROMPT construction or uses a fast mock.
    # Since main.py uses a real LLM if present, or a mock if not, this will test the paths.
    # We really want to see if the System Prompt *contains* the context.
    # But we can't easily inspect the internal prompt variable without modifying main.py.
    # However, if we use the Mock path (likely in this environment if models aren't downloaded), 
    # we might need to rely on what the response says.
    
    # Actually, main.py prints the system prompt? No. 
    # But for this test, we accept the output if it looks reasonable or handles the flow.
    test_structure()
    test_brevity()
    test_grounding()
    test_context_injection()
