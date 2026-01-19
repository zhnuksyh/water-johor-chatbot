import logging
from livekit.agents import JobContext, WorkerOptions, cli, job
from livekit.agents.voice import Agent as VoicePipelineAgent
from livekit.plugins import silero
from local_plugins import LocalSTT, LocalTTS, LocalLLM

logger = logging.getLogger("voice-assistant")

def prewarm(proc: job.JobProcess):
    proc.userdata["vad"] = silero.VAD.load()

async def entrypoint(ctx: JobContext):
    logger.info("starting entrypoint")
    
    vad = ctx.proc.userdata["vad"]
    stt = LocalSTT()
    llm = LocalLLM()
    tts = LocalTTS()

    agent = VoicePipelineAgent(
        vad=vad,
        stt=stt,
        llm=llm,
        tts=tts,
    )
    
    agent.start(ctx.room)
    
    await agent.say("Hello, I am your local voice assistant. How can I help you?", allow_interruptions=True)

if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint, prewarm_fnc=prewarm))
