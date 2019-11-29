import EventEmitter from 'eventemitter3'
import superagent from 'superagent'

class ApiBase extends EventEmitter {
  constructor(apiBase, apiToken, tokenType) {
    super()
    if (apiToken) {
      this.setToken(apiToken, tokenType)
    }
    this.apiBase = apiBase
  }

  get isAuthenticated() {
    return Boolean(this.token)
  }

  setToken(apiToken, tokenType) {
    if (tokenType) this.token = `${tokenType} ${apiToken}`
    else this.token = apiToken
    this.emit('tokenUpdate')
  }
  apiRequestRaw(method, path, body) {
    let request = superagent[method](this.apiBase + path)
    if (this.token) request = request.set('Authorization', this.token)
    if (body) request = request.send(body)
    return new Promise((resolve, reject) => {
      request.end((error, response) => {
        if (error) reject(error)
        if (response) resolve(response)
      })
    })
  }
  async apiRequestBody(method, path, body) {
    const response = await this.apiRequestRaw(method, path, body)
    return response.body
  }
}

class VAPI extends ApiBase {
  constructor() {
    super('https://api.vap.cx')
  }

  async getSpotifyToken() {
    const data = await this.apiRequestBody('get', '/spotify-token')
    return { token: data.token, tokenType: data.type }
  }

  getData(filePath) {
    return this.apiRequestBody('get', '/data' + filePath)
  }
  getMultiData(path, files) {
    return this.apiRequestBody(
      'get',
      `/multi-data${path}?${files.map(f => 'files[]=' + f).join('&')}`
    )
  }
}

class Spotify extends ApiBase {
  constructor(vapi) {
    super('https://api.spotify.com/v1')
    vapi
      .getSpotifyToken()
      .then(data => {
        if (!data.token)
          console.error('Could not get spotify token: token is null')
        else this.setToken(data.token, data.tokenType)
      })
      .catch(error => {
        console.error('Could not get spotify token:', error)
      })
  }

  getTrack(trackId) {
    return this.apiRequestBody('get', `/tracks/${trackId}`)
  }
  getTracks(trackIds) {
    return this.apiRequestBody('get', `/tracks?ids=${trackIds.join(',')}`)
  }
  getAlbum(albumId) {
    return this.apiRequestBody('get', `/albums/${albumId}`)
  }
  getPlaylist(playlistId, query = '') {
    return this.apiRequestBody('get', `/playlists/${playlistId}?${query}`)
  }
}

const vapi = new VAPI()
const spotify = new Spotify(vapi)

export { spotify, vapi }
