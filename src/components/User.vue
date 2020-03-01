<template>
  <div class="user">
    <div class="header" v-if="user">
      <img class="avatar" :src="avatarUrl" @error="onAvatarError">
      <div class="tag">
        <div class="username">{{ user.username }}</div>
        <div class="discrim">#{{ user.discriminator }}</div>
      </div>
      <div class="spacer">
        <div
          v-if="status === 'Not Listening' && lastListen"
        >({{ formatTimeDiff(nowDate - lastListen) }})</div>
      </div>
      <div class="status" v-if="status === 'Listening'">{{ status }}</div>
      <div class="status-circle" :style="{
        background: statusColor
      }"></div>
    </div>
    <Track v-if="isUser && now" :trackId="now" :autoPalette="true" :showPalette="showPalette"/>
    <div
      class="history-btn"
      v-if="isUser && history.length"
      @click="toggleHistory"
    >{{ showHistory ? 'Hide' : 'Show' }} History</div>
    <div class="history scroller" v-if="isUser && showHistory && history.length">
      <div v-for="(item, i) in history" :key="i" class="history-item">
        <Track
          v-if="item.type === 'track'"
          :trackId="item.id"
          :hideCover="true"
          :note="formatTimeDiff(nowDate - item.s - item.t)"
        />
        <div
          v-if="item.type === 'skipped'"
          class="skipped-container"
          :class="{ open: openSkips[i] }"
        >
          <span
            @click="toggleSkip(i)"
          >{{ item.tracks.length }} Song{{ item.tracks.length === 1 ? '' : 's' }} Skipped</span>
          <div class="skipped" v-show="openSkips[i]">
            <Track
              v-for="(trackId, j) in item.tracks"
              :key="j"
              :trackId="trackId"
              :hideCover="true"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { formatDistanceStrict } from 'date-fns'
import { mapState } from 'vuex'
import qs from 'qs'
import { spotify, vapi } from '../api.js'
import Track from '@/components/Track.vue'

const q = qs.parse(window.location.search.slice(1))
const showPalette = q.showpalette != null

const defaultAvatars = [
  'https://canary.discordapp.com/assets/6debd47ed13483642cf09e832ed0bc1b.png'
]
const defaultUser = {
  id: null,
  avatar: null,
  username: 'Deleted User',
  discriminator: '0000'
}

export default {
  name: 'User',
  components: {
    Track
  },
  props: {
    userId: { type: String, required: true }
  },
  data() {
    return {
      showHistory: false,
      openSkips: {},
      avatarError: false,
      showPalette
    }
  },
  computed: {
    ...mapState(['nowDate', 'tracks', 'albums', 'artists', 'users']),
    user() {
      const user = this.users[this.userId]
      if (user) return user.member
      return null
    },
    activity() {
      const user = this.users[this.userId]
      if (user) return user.activity
      return []
    },
    lastListen() {
      const user = this.users[this.userId]
      if (user) return user.lastListen
      return null
    },
    now() {
      const lastActivity = this.activity[this.activity.length - 1]
      if (!lastActivity || lastActivity.t) return null
      return lastActivity.id
    },
    avatarUrl() {
      if (!this.user) return defaultAvatars[0]
      const { avatarError } = this
      const { avatar } = this.user
      if (avatar && !avatarError) {
        const ext = avatar.startsWith('a_') ? 'gif' : 'png'
        return `https://cdn.discordapp.com/avatars/${
          this.userId
        }/${avatar}.${ext}?size=64`
      } else {
        return defaultAvatars[0]
      }
    },
    status() {
      if (this.now) return 'Listening'
      return 'Not Listening'
    },
    statusColor() {
      if (this.now) return '#1ED760'
      return 'rgba(255, 255, 255, .5)'
    },
    history() {
      const history = []
      let lastEntry
      for (let i = this.activity.length - (this.now ? 2 : 1); i >= 0; i--) {
        let lastEntry = history[history.length - 1]
        const activity = this.activity[i]
        if (activity.t > 20000) {
          history.push({
            type: 'track',
            id: activity.id,
            s: activity.s,
            t: activity.t
          })
        } else {
          if (!lastEntry || lastEntry.type !== 'skipped') {
            history.push({
              type: 'skipped',
              tracks: []
            })
            lastEntry = history[history.length - 1]
          }
          lastEntry.tracks.push(activity.id)
        }
      }
      lastEntry = history[history.length - 1]
      if (lastEntry && lastEntry.type !== 'track') history.pop()
      return history
    },
    isUser() {
      return this.user && this.user.discriminator !== '0000'
    }
  },
  methods: {
    formatTimeDiff(diff) {
      return diff < 5000
        ? 'just now'
        : formatDistanceStrict(this.nowDate, this.nowDate - diff).replace(
            /(\d+) (second|minute|hour|day|week|month|year)s?/,
            (m, d, u) => {
              const letter = {
                second: 's',
                minute: 'm',
                hour: 'h',
                day: 'd',
                week: 'w',
                month: 'mo',
                year: 'y'
              }[u]
              return `${d}${letter} ago`
            }
          )
    },
    toggleHistory() {
      this.showHistory = !this.showHistory
    },
    toggleSkip(i) {
      // Do nothing until performance can be improved
      // this.openSkips[i] = !this.openSkips[i]
    },
    
    onAvatarError() {
      this.avatarError = true
    }
  }
}
</script>

<style lang="scss">
.user {
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  .header {
    align-items: center;
    background: #2F3136;
    display: flex;
    padding: 6px 12px;
    white-space: nowrap;
  }
  .spacer {
    color: rgba(#fff, 0.2);
    flex: 1;
    font-size: 12px;
    padding: 0 16px;
    text-align: right;
    user-select: none;
  }
  .avatar {
    border-radius: 50%;
    margin-right: 6px;
    width: 32px;
  }
  .tag {
    overflow: hidden;
  }
  .username {
    color: rgba(#fff, 0.9);
    font-size: 15px;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .discrim {
    color: rgba(#fff, 0.6);
    font-size: 13px;
  }
  .status {
    color: rgba(#fff, 0.6);
    font-size: 15px;
  }
  .status-circle {
    $size: 8px;
    border-radius: 50%;
    height: $size;
    margin-left: 6px;
    min-width: $size;
    width: $size;
  }
  .history-btn {
    background: #404040;
    color: rgba(#fff, 0.5);
    cursor: pointer;
    font-size: 12px;
    padding: 8px;
    text-align: center;
    text-transform: uppercase;
    user-select: none;
  }
  .history {
    max-height: 300px;
    border: 6px solid #404040;
    border-radius: 0 2px;
    border-top: none;
    border-right: none;
    overflow-x: hidden;
    overflow-y: scroll;
  }
  .history-item:first-child .skipped-container {
    height: auto;
  }
  .skipped-container {
    align-items: center;
    background: #121212;
    color: rgba(255, 255, 255, 0.5);
    /* cursor: pointer; */
    display: flex;
    flex-direction: column;
    font-size: 10px;
    height: 4px;
    justify-content: center;
    text-transform: uppercase;
    &.open {
      cursor: default;
      height: auto;
      & > span {
        cursor: pointer;
        width: 100%;
      }
    }
    & > span {
      background: #121212;
      border-radius: 3px;
      box-sizing: border-box;
      padding: 1px 6px;
      text-align: center;
      user-select: none;
      z-index: 5;
    }
    .skipped {
      border: 3px solid #121212;
      border-top: none;
      box-sizing: border-box;
      width: 100%;
    }
  }
}
</style>
