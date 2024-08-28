class FIFOBufferV1 {
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

class FIFOBuffer {
  constructor() {
    this.buffer = new Array(180);
    this.head = 0;
    this.tail = 0;
  }

  enqueue(element) {
    this.buffer[this.head] = element;
    this.head = (this.head + 1) % this.buffer.length;
  }

  dequeue() {
    if (this.isEmpty()) {
      throw new Error("Buffer is empty");
    }
    let element = this.buffer[this.tail];
    this.tail = (this.tail + 1) % this.buffer.length;
    return element;
  }

  isEmpty() {
    return this.tail === this.head;
  }

  hasData() {
    return this.tail !== this.head;
  }

  size() {
    return (this.head - this.tail + this.buffer.length) % this.buffer.length;
  }
}

export { FIFOBuffer };
