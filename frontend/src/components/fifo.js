class FIFOBuffer {
  constructor() {
    this.buffer = [];
  }

  enqueue(element) {
    this.buffer.push(element);
  }

  dequeue() {
    if (this.isEmpty()) {
      throw new Error("Buffer is empty");
    }
    return this.buffer.shift();
  }

  isEmpty() {
    return this.buffer.length === 0;
  }

  size() {
    return this.buffer.length;
  }

  peek() {
    if (this.isEmpty()) {
      throw new Error("Buffer is empty");
    }
    return this.buffer[0];
  }
}

export { FIFOBuffer };
