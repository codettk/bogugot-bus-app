export class GyeonggiApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public apiCode?: string,
  ) {
    super(message)
    this.name = 'GyeonggiApiError'
  }
}

export class CacheError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CacheError'
  }
}
