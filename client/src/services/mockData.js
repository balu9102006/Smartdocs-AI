export const sampleDocuments = [
  {
    id: 'doc-1',
    fileName: 'Deep_Learning_Fundamentals.pdf',
    fileType: 'pdf',
    fileSize: 3450000,
    totalPages: 48,
    status: 'ready',
    uploadedAt: '2026-09-10T10:15:00Z',
    description: 'Comprehensive guide covering neural network architectures, backpropagation, activation functions, and transformer models.',
    summary: `This document provides a foundational and mathematical treatment of Deep Learning. Key topics covered include:
- **Neural Network Architecture**: Perceptrons, multi-layer perceptrons, forward propagation, loss functions (cross-entropy, MSE).
- **Optimization Techniques**: Gradient descent, Stochastic Gradient Descent (SGD), Adam optimizer, and learning rate scheduling.
- **Modern Transformer Architecture**: Self-attention mechanisms, multi-head attention, positional encodings, and encoder-decoder design patterns.
- **Regularization & Training**: Dropout, batch normalization, layer normalization, weight decay, and early stopping.`,
    keyPoints: [
      'Gradient descent computes the gradient of the loss function with respect to model weights via the chain rule (backpropagation).',
      'Transformers replace recurrent connections entirely with multi-head self-attention, enabling parallel token processing.',
      'Batch Normalization stabilizes internal covariate shift by standardizing activations per mini-batch.',
      'Overfitting can be mitigated using dropout, L2 weight regularization, data augmentation, and early stopping.'
    ],
    mcqs: [
      {
        id: 'q1',
        question: 'Which activation function is most commonly used in hidden layers of modern deep feedforward networks to mitigate vanishing gradients?',
        options: ['Sigmoid', 'ReLU (Rectified Linear Unit)', 'Softmax', 'Step Function'],
        correctIndex: 1,
        explanation: 'ReLU outputs 0 for negative inputs and x for positive inputs, maintaining a gradient of 1 for positive values and greatly mitigating the vanishing gradient problem.'
      },
      {
        id: 'q2',
        question: 'What is the primary computational advantage of the Transformer architecture over traditional Recurrent Neural Networks (RNNs)?',
        options: [
          'It completely eliminates the need for matrix multiplications.',
          'It allows parallel processing of all tokens in a sequence simultaneously using self-attention.',
          'It requires zero training parameters.',
          'It works exclusively without any positional information.'
        ],
        correctIndex: 1,
        explanation: 'Self-attention calculates token interactions across the entire sequence in parallel via matrix operations, whereas RNNs process tokens sequentially step-by-step.'
      },
      {
        id: 'q3',
        question: 'In gradient descent, what does the learning rate hyperparameter directly control?',
        options: [
          'The number of hidden layers in the network',
          'The size of the step taken in the opposite direction of the gradient',
          'The dimension of the embedding vector',
          'The percentage of neurons dropped during dropout'
        ],
        correctIndex: 1,
        explanation: 'The learning rate scales the magnitude of parameter updates along the negative gradient vector at each optimization step.'
      }
    ],
    initialMessages: [
      {
        id: 'm1',
        role: 'user',
        content: 'What are the main advantages of using Transformers over RNNs?',
        createdAt: '2026-09-10T10:20:00Z'
      },
      {
        id: 'm2',
        role: 'assistant',
        content: `Based on **Chapter 4 (Sequence Modeling)** of your uploaded document, the primary advantages of Transformers over RNNs are:

1. **Parallel Training**: Unlike RNNs which must process sequences sequentially ($h_t = f(h_{t-1}, x_t)$), Transformers process all tokens simultaneously using multi-head self-attention.
2. **Mitigated Long-Range Forgetting**: In RNNs/LSTMs, information degrades across long time horizons. Transformers compute direct pairwise token attention regardless of distance ($O(1)$ path length).
3. **Hardware Efficiency**: Self-attention operations map directly into large, dense matrix multiplications optimized for modern GPU tensor cores.`,
        sources: [
          { chunkId: 'c-104', page: 28, text: 'Transformer self-attention matrix QK^T / sqrt(d_k) computes direct cross-token dependency in parallel...' },
          { chunkId: 'c-108', page: 31, text: 'Sequential bottleneck in recurrent loops prevented scalable distributed GPU throughput.' }
        ],
        createdAt: '2026-09-10T10:20:04Z'
      }
    ]
  },
  {
    id: 'doc-2',
    fileName: 'System_Design_Handbook.docx',
    fileType: 'docx',
    fileSize: 1820000,
    totalPages: 32,
    status: 'ready',
    uploadedAt: '2026-09-11T14:30:00Z',
    description: 'System design principles: microservices, distributed caching, consistency models (CAP theorem), and rate limiting strategies.',
    summary: `A complete handbook on designing scalable and resilient distributed systems:
- **Scalability**: Horizontal vs. vertical scaling, database sharding, and stateless application tiers.
- **Caching**: Write-through, write-back, cache-aside strategies with Redis/Memcached.
- **CAP Theorem**: Trade-offs between Consistency, Availability, and Partition Tolerance in distributed data stores.
- **Rate Limiting**: Token Bucket, Leaky Bucket, and Fixed Window algorithms.`,
    keyPoints: [
      'Stateless web servers behind a load balancer provide seamless horizontal auto-scaling.',
      'Cache-aside (lazy loading) avoids filling memory with unrequested data.',
      'According to CAP theorem, a distributed network must choose between Consistency and Availability during network partitions.',
      'Token bucket is the industry standard for API rate limiting due to burst support.'
    ],
    mcqs: [
      {
        id: 'q1',
        question: 'Which rate limiting algorithm allows bursts of traffic up to a predefined capacity while refilling at a steady rate?',
        options: ['Fixed Window Counter', 'Token Bucket', 'Sliding Window Log', 'Round Robin'],
        correctIndex: 1,
        explanation: 'Token bucket allows bursts because tokens accumulate up to the bucket capacity during idle times.'
      }
    ],
    initialMessages: [
      {
        id: 'm1',
        role: 'user',
        content: 'Explain the Cache-Aside pattern as described in the document.',
        createdAt: '2026-09-11T14:32:00Z'
      },
      {
        id: 'm2',
        role: 'assistant',
        content: `According to **Section 3.2 (Distributed Caching Strategies)**:

In the **Cache-Aside** (Lazy Loading) pattern:
1. The application first queries the cache for data.
2. If cache hit: data is returned immediately.
3. If cache miss: the application reads the data from the database, writes it into the cache with a TTL (Time-To-Live), and returns it to the client.

**Key advantage**: Only requested data is cached, preventing cache saturation with unused entries.`,
        sources: [
          { chunkId: 'c-204', page: 12, text: 'Under cache-aside, the application coordinates directly with both cache and DB...' }
        ],
        createdAt: '2026-09-11T14:32:03Z'
      }
    ]
  },
  {
    id: 'doc-3',
    fileName: 'Quarterly_Financial_Report.pdf',
    fileType: 'pdf',
    fileSize: 4200000,
    totalPages: 24,
    status: 'processing',
    uploadedAt: '2026-09-13T09:00:00Z',
    description: 'Q3 Financial results, operational expenses, balance sheet overview, and 2027 fiscal forecast.',
    summary: 'Document is currently being processed: extracting text and generating vector embeddings...',
    keyPoints: [],
    mcqs: [],
    initialMessages: []
  }
];

