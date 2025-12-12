"""Request queue for GPU operations."""

import asyncio
import contextlib
import logging
from collections.abc import Callable, Coroutine
from typing import TypeVar

logger = logging.getLogger(__name__)

T = TypeVar("T")


class GPUQueue:
    """Queue for GPU operations - ensures only one GPU task runs at a time."""

    def __init__(self):
        self._queue: asyncio.Queue = asyncio.Queue()
        self._worker_task: asyncio.Task | None = None

    async def start(self):
        """Start the queue worker."""
        self._worker_task = asyncio.create_task(self._worker())
        logger.info("GPU queue worker started")

    async def stop(self):
        """Stop the queue worker."""
        if self._worker_task:
            self._worker_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._worker_task
            logger.info("GPU queue worker stopped")

    async def _worker(self):
        """Process queued GPU tasks one at a time."""
        while True:
            task, future = await self._queue.get()
            try:
                result = await task()
                future.set_result(result)
            except Exception as e:
                future.set_exception(e)
            finally:
                self._queue.task_done()
                # Clear GPU cache after each operation
                try:
                    import torch

                    if torch.cuda.is_available():
                        torch.cuda.empty_cache()
                except Exception:
                    pass

    async def submit(self, task: Callable[[], Coroutine[None, None, T]]) -> T:
        """Submit a task and wait for result."""
        future: asyncio.Future[T] = asyncio.Future()
        await self._queue.put((task, future))
        return await future

    @property
    def pending(self) -> int:
        """Number of pending tasks in queue."""
        return self._queue.qsize()


gpu_queue = GPUQueue()
