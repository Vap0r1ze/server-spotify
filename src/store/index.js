import Vue from 'vue'
import Vuex from 'vuex'
import localforage from 'localforage'

Vue.use(Vuex)

export default new Vuex.Store({
  state: {
    nowDate: Date.now(),
    tracks: {},
    albums: {},
    artists: {},
    users: {}
  },
  mutations: {
    saveTrack(state, { id, track }) {
      state.tracks[id] = track
    },
    saveAlbum(state, { id, album }) {
      state.albums[id] = album
    },
    saveArtist(state, { id, artist }) {
      state.artists[id] = artist
    },
    setNowDate(state, date) {
      state.nowDate = date
    },
    updateUser(state, { userId, data }) {
      state.users[userId] = Object.assign({}, state.users[userId], data)
    },
    reinitUsers(state) {
      state.users = { ...state.users }
    }
  },
  actions: {
    updateNow({ commit }) {
      commit('setNowDate', Date.now())
    },
    async loadIndexedDB({ commit }) {
      const tracks = JSON.parse(await localforage.getItem('tracks'))
      const artists = JSON.parse(await localforage.getItem('artists'))
      const albums = JSON.parse(await localforage.getItem('albums'))
      for (const [id, track] of Object.entries(tracks))
        commit('saveTrack', { id, track })
      for (const [id, artist] of Object.entries(artists))
        commit('saveArtist', { id, artist })
      for (const [id, album] of Object.entries(albums))
        commit('saveAlbum', { id, album })
    },
    async saveTracks({ commit, state }, tracks) {
      let changes = 0
      for (const track of tracks) {
        if (track.id in state.tracks) continue
        changes++
        commit('saveTrack', {
          id: track.id,
          track: {
            id: track.id,
            album: track.album.id,
            artists: track.artists.map(artist => artist.id),
            name: track.name,
            duration: track.duration_ms
          }
        })
        for (const artist of track.artists) {
          if (artist.id in state.artists) continue
          commit('saveArtist', {
            id: artist.id,
            artist: {
              id: artist.id,
              name: artist.name
            }
          })
        }
        if (!(track.album.id in state.albums)) {
          commit('saveAlbum', {
            id: track.album.id,
            album: {
              id: track.album.id,
              name: track.album.name,
              images: track.album.images
            }
          })
        }
      }
      if (changes > 0) {
        await localforage.setItem('tracks', JSON.stringify(state.tracks))
        await localforage.setItem('artists', JSON.stringify(state.artists))
        await localforage.setItem('albums', JSON.stringify(state.albums))
      }
    },
    updateUser({ commit }, { userId, data }) {
      commit('updateUser', { userId, data })
    },
    reinitUsers({ commit }) {
      commit('reinitUsers')
    }
  }
})
